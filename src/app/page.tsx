import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, FileText, Newspaper, Users } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { MonthlyGoalChart } from "./_components/monthly-goal-chart"


export default function DashboardPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Players</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">42</div>
            <p className="text-xs text-muted-foreground">+2 from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">News Articles</CardTitle>
            <Newspaper className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">125</div>
            <p className="text-xs text-muted-foreground">+15 this week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Match Summaries</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">38</div>
            <p className="text-xs text-muted-foreground">Season total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scouting Reports</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">73</div>
            <p className="text-xs text-muted-foreground">+5 new reports</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <MonthlyGoalChart />
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Recent News</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              <li className="flex items-start gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold">Capital City Triumphs in Derby</h3>
                  <p className="text-sm text-muted-foreground">A thrilling 2-1 victory against our rivals...</p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/news">Read</Link>
                </Button>
              </li>
              <li className="flex items-start gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold">Star Striker Signs Extension</h3>
                  <p className="text-sm text-muted-foreground">Leo Rivera commits to three more years...</p>
                </div>
                 <Button variant="outline" size="sm" asChild>
                  <Link href="/news">Read</Link>
                </Button>
              </li>
              <li className="flex items-start gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold">Youth Academy Promotions</h3>
                  <p className="text-sm text-muted-foreground">Three promising talents join the first team...</p>
                </div>
                 <Button variant="outline" size="sm" asChild>
                  <Link href="/news">Read</Link>
                </Button>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
