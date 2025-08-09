"use client"

import { Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart as RechartsBarChart } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

const chartData = [
  { month: "January", goals: 12 },
  { month: "February", goals: 19 },
  { month: "March", goals: 15 },
  { month: "April", goals: 23 },
  { month: "May", goals: 18 },
  { month: "June", goals: 25 },
]

const chartConfig = {
  goals: {
    label: "Goals",
    color: "hsl(var(--primary))",
  },
}

export function MonthlyGoalChart() {
    return (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-headline">Monthly Goal Performance</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <ResponsiveContainer>
                <RechartsBarChart data={chartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    tickFormatter={(value) => value.slice(0, 3)}
                  />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="goals" fill="var(--color-goals)" radius={4} />
                </RechartsBarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
    )
}
