import { prisma } from "@/lib/db";
import type { DependencyType } from "@prisma/client";

/**
 * TaskDependencyService — DAG-based task dependency engine.
 *
 * Handles:
 * - Adding/removing dependencies
 * - Cycle detection (prevents circular dependencies)
 * - Auto-resolving: when a blocker completes, unblocks dependents
 * - Dependency graph queries
 */
export class TaskDependencyService {
  /**
   * Add a dependency: taskId depends on dependsOnId.
   * Prevents self-references and cycles.
   */
  static async addDependency(
    taskId: string,
    dependsOnId: string,
    type: DependencyType = "BLOCKS"
  ) {
    if (taskId === dependsOnId) {
      throw new Error("A task cannot depend on itself");
    }

    // Check for cycles (DFS)
    const hasCycle = await this.wouldCreateCycle(taskId, dependsOnId);
    if (hasCycle) {
      throw new Error("Adding this dependency would create a circular reference");
    }

    const dep = await prisma.taskDependency.create({
      data: { taskId, dependsOnId, type },
    });

    // If the dependency blocks and the depended task is not completed, block the task
    if (type === "BLOCKS") {
      const dependsOn = await prisma.task.findUnique({
        where: { id: dependsOnId },
        select: { status: true },
      });
      if (dependsOn && !["COMPLETED", "CANCELLED"].includes(dependsOn.status)) {
        await prisma.task.update({
          where: { id: taskId },
          data: { status: "BLOCKED", blockedBy: `Depends on: ${dependsOnId}` },
        });
      }
    }

    return dep;
  }

  /**
   * Remove a dependency.
   */
  static async removeDependency(taskId: string, dependsOnId: string) {
    await prisma.taskDependency.deleteMany({
      where: { taskId, dependsOnId },
    });

    // Check if task has other blockers; if not, unblock it
    await this.checkAndUnblock(taskId);
  }

  /**
   * Called when a task completes — resolves all dependents.
   */
  static async resolveCompletedTask(completedTaskId: string) {
    const dependents = await prisma.taskDependency.findMany({
      where: { dependsOnId: completedTaskId, type: "BLOCKS" },
      select: { taskId: true },
    });

    const unblockedIds: string[] = [];

    for (const dep of dependents) {
      const unblocked = await this.checkAndUnblock(dep.taskId);
      if (unblocked) unblockedIds.push(dep.taskId);
    }

    return unblockedIds;
  }

  /**
   * Check if a task can be unblocked (all BLOCKS dependencies completed).
   */
  static async checkAndUnblock(taskId: string): Promise<boolean> {
    const blockingDeps = await prisma.taskDependency.findMany({
      where: { taskId, type: "BLOCKS" },
      include: { dependsOn: { select: { status: true } } },
    });

    const allResolved = blockingDeps.every((dep) =>
      ["COMPLETED", "CANCELLED"].includes(dep.dependsOn.status)
    );

    if (allResolved || blockingDeps.length === 0) {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { status: true },
      });
      if (task?.status === "BLOCKED") {
        await prisma.task.update({
          where: { id: taskId },
          data: { status: "PENDING", blockedBy: null },
        });
        return true;
      }
    }

    return false;
  }

  /**
   * Get the full dependency graph for a task (both directions).
   */
  static async getDependencyGraph(taskId: string) {
    const [dependencies, dependents] = await Promise.all([
      prisma.taskDependency.findMany({
        where: { taskId },
        include: {
          dependsOn: {
            select: { id: true, title: true, status: true, priority: true, module: true },
          },
        },
      }),
      prisma.taskDependency.findMany({
        where: { dependsOnId: taskId },
        include: {
          task: {
            select: { id: true, title: true, status: true, priority: true, module: true },
          },
        },
      }),
    ]);

    return { dependencies, dependents };
  }

  /**
   * Get all unresolved blockers for a task.
   */
  static async getUnresolvedBlockers(taskId: string) {
    const blockers = await prisma.taskDependency.findMany({
      where: { taskId, type: "BLOCKS" },
      include: {
        dependsOn: {
          select: { id: true, title: true, status: true, priority: true, module: true, slaDeadline: true },
        },
      },
    });

    return blockers.filter(
      (b) => !["COMPLETED", "CANCELLED"].includes(b.dependsOn.status)
    );
  }

  /**
   * DFS cycle detection — checks if adding edge taskId→dependsOnId creates a cycle.
   */
  private static async wouldCreateCycle(
    taskId: string,
    dependsOnId: string
  ): Promise<boolean> {
    // If dependsOnId already depends (directly or transitively) on taskId, it's a cycle
    const visited = new Set<string>();
    const stack = [dependsOnId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === taskId) return true; // cycle!
      if (visited.has(current)) continue;
      visited.add(current);

      const deps = await prisma.taskDependency.findMany({
        where: { dependsOnId: current },
        select: { taskId: true },
      });

      for (const dep of deps) {
        if (!visited.has(dep.taskId)) {
          stack.push(dep.taskId);
        }
      }
    }

    return false;
  }

  /**
   * Get critical path: the longest chain of blocking dependencies.
   */
  static async getCriticalPath(tenantId: string): Promise<string[]> {
    // Get all active tasks with blocking dependencies
    const allDeps = await prisma.taskDependency.findMany({
      where: {
        type: "BLOCKS",
        task: { tenantId, status: { notIn: ["COMPLETED", "CANCELLED"] } },
      },
      select: { taskId: true, dependsOnId: true },
    });

    if (allDeps.length === 0) return [];

    // Build adjacency list and find longest path
    const adj = new Map<string, string[]>();
    const allNodes = new Set<string>();

    for (const dep of allDeps) {
      allNodes.add(dep.taskId);
      allNodes.add(dep.dependsOnId);
      if (!adj.has(dep.dependsOnId)) adj.set(dep.dependsOnId, []);
      adj.get(dep.dependsOnId)!.push(dep.taskId);
    }

    // Find longest path using DFS
    let longestPath: string[] = [];

    function dfs(node: string, path: string[]) {
      path.push(node);
      if (path.length > longestPath.length) {
        longestPath = [...path];
      }
      const neighbors = adj.get(node) ?? [];
      for (const next of neighbors) {
        if (!path.includes(next)) {
          dfs(next, path);
        }
      }
      path.pop();
    }

    // Start DFS from nodes with no incoming edges (roots)
    const hasIncoming = new Set(allDeps.map((d) => d.taskId));
    const roots = [...allNodes].filter((n) => !hasIncoming.has(n));

    for (const root of roots) {
      dfs(root, []);
    }

    return longestPath;
  }
}
