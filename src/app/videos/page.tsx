import { players, videos } from "@/lib/data"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, Tag, Search } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import Image from "next/image"
import Link from "next/link"

export default function VideosPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">Manage Videos</CardTitle>
              <CardDescription>Upload new videos and tag players.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="video-file">
                  <Upload className="inline-block mr-2 h-4 w-4" />
                  Upload Video
                </Label>
                <Input id="video-file" type="file" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="video-title">Video Title</Label>
                <Input id="video-title" placeholder="e.g., Highlights vs. Rovers" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="player-tag">
                  <Tag className="inline-block mr-2 h-4 w-4" />
                  Tag Players
                </Label>
                <Select>
                  <SelectTrigger id="player-tag">
                    <SelectValue placeholder="Select players to tag" />
                  </SelectTrigger>
                  <SelectContent>
                    {players.map((player) => (
                      <SelectItem key={player.id} value={player.id}>
                        {player.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full">Save Video</Button>
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-2">
          <div className="mb-6">
            <h2 className="text-2xl font-headline font-bold">Video Library</h2>
            <div className="mt-2 max-w-sm relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search videos..." className="pl-10" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {videos.map((video) => (
              <Link href="/videos" key={video.id}>
                <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="relative aspect-video">
                    <Image
                      src={video.thumbnailUrl}
                      alt={video.title}
                      fill
                      className="object-cover"
                      data-ai-hint="soccer action"
                    />
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded-sm">
                      {video.duration}
                    </div>
                  </div>
                  <CardHeader className="p-4">
                    <CardTitle className="text-lg font-semibold truncate">
                      {video.title}
                    </CardTitle>
                    <CardDescription>
                      {video.taggedPlayerIds.length} player(s) tagged
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
