import { KeyboardShortcuts } from "@/components/tasks/keyboard-shortcuts";

export default function TasksLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <KeyboardShortcuts />
    </>
  );
}
