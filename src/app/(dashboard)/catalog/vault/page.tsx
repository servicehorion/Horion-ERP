import { Suspense } from "react";
import {
  Image as ImageIcon,
  Video,
  FileText,
  File,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { getMediaList } from "@/lib/actions/catalog.actions";
import { formatDate } from "@/lib/utils";

export const metadata = {
  title: "Coffre Médias | Horion ERP",
};

const MEDIA_ICONS: Record<string, React.ReactNode> = {
  image: <ImageIcon className="h-8 w-8" />,
  video: <Video className="h-8 w-8" />,
  pdf: <FileText className="h-8 w-8" />,
  document: <File className="h-8 w-8" />,
};

const MEDIA_COLORS: Record<string, string> = {
  image: "text-green-600",
  video: "text-purple-600",
  pdf: "text-red-600",
  document: "text-blue-600",
};

export default async function VaultPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Coffre Médias & Preuves</h1>
        <p className="text-muted-foreground">
          Photos, vidéos, documents et preuves liés au catalogue
        </p>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">Tous</TabsTrigger>
          <TabsTrigger value="image">Images</TabsTrigger>
          <TabsTrigger value="video">Vidéos</TabsTrigger>
          <TabsTrigger value="pdf">PDF</TabsTrigger>
          <TabsTrigger value="document">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Suspense fallback={<VaultSkeleton />}>
            <MediaGrid />
          </Suspense>
        </TabsContent>
        <TabsContent value="image">
          <Suspense fallback={<VaultSkeleton />}>
            <MediaGrid type="image" />
          </Suspense>
        </TabsContent>
        <TabsContent value="video">
          <Suspense fallback={<VaultSkeleton />}>
            <MediaGrid type="video" />
          </Suspense>
        </TabsContent>
        <TabsContent value="pdf">
          <Suspense fallback={<VaultSkeleton />}>
            <MediaGrid type="pdf" />
          </Suspense>
        </TabsContent>
        <TabsContent value="document">
          <Suspense fallback={<VaultSkeleton />}>
            <MediaGrid type="document" />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VaultSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

async function MediaGrid({ type }: { type?: string } = {}) {
  const result = await getMediaList(type ? { type } : {});

  if (result.error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
        {result.error}
      </div>
    );
  }

  const mediaList = result.data || [];

  if (mediaList.length === 0) {
    return (
      <EmptyState
        title="Aucun média"
        description="Les fichiers médias et preuves apparaîtront ici"
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {mediaList.map((media) => {
        const tags = Array.isArray(media.tags) ? (media.tags as string[]) : [];

        return (
          <Card key={media.id} className="overflow-hidden">
            <CardContent className="p-4 space-y-3">
              {/* Icon + type */}
              <div className="flex items-center gap-3">
                <div className={MEDIA_COLORS[media.type] || "text-gray-600"}>
                  {MEDIA_ICONS[media.type] || <File className="h-8 w-8" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {media.filename || "Sans nom"}
                  </p>
                  <Badge variant="outline" className="text-xs mt-1">
                    {media.type}
                  </Badge>
                </div>
              </div>

              {/* Linked entity */}
              <div className="flex flex-wrap gap-1">
                <Badge variant="secondary" className="text-xs">
                  {media.linkedEntityType}
                </Badge>
              </div>

              {/* Tags */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tags.map((tag, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Date */}
              <p className="text-xs text-muted-foreground">
                {formatDate(media.createdAt)}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
