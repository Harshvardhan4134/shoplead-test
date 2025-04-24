import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { db } from "@/lib/db";
import {
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  LineChart as LineChartIcon,
  Calendar,
  ArrowRight,
  Info,
  Clock,
  CheckCircle2,
  ChevronDown,
  Calculator
} from "lucide-react";

// Sample data for forecasting
const forecastData = {
  summary: {
    jobsForecasted: 28,
    onTimeDelivery: 92,
    resourceUtilization: 78,
    costVariance: -3.2,
  },
  jobs: [
    {
      jobId: "JOB-2023-005",
      description: "Precision Valve Assembly",
      status: "In Progress",
      completionDate: "2025-05-15",
      confidence: 85,
      risk: "Low",
      recommendation: "On track for delivery",
      explanation: "Current progress indicates on-time completion with high probability. Resource allocation is optimal."
    },
    {
      jobId: "JOB-2023-008",
      description: "Custom Hydraulic System",
      status: "In Progress",
      completionDate: "2025-05-22",
      confidence: 65,
      risk: "Medium",
      recommendation: "Additional resources needed",
      explanation: "Current progress is behind schedule. Recommend allocating additional machining resources."
    },
    {
      jobId: "JOB-2023-012",
      description: "Gear Assembly Retrofit",
      status: "Delayed",
      completionDate: "2025-06-10",
      confidence: 45,
      risk: "High",
      recommendation: "Expedite material procurement",
      explanation: "Material delays have impacted timeline. Recommend sourcing alternative supplier for critical components."
    }
  ],
  workCenters: [
    {
      workCenter: "CNC Machining",
      currentUtilization: 85,
      forecastedUtilization: 92,
      recommendation: "Consider overtime or additional shift",
      riskLevel: "Medium",
      confidence: 89,
      explanation: "Upcoming jobs will increase utilization beyond optimal capacity. Schedule optimization recommended.",
      departments: [
        { name: "Milling", value: 90 },
        { name: "Turning", value: 95 },
        { name: "Grinding", value: 86 }
      ]
    },
    {
      workCenter: "Assembly",
      currentUtilization: 68,
      forecastedUtilization: 75,
      recommendation: "Maintain current staffing",
      riskLevel: "Low",
      confidence: 92,
      explanation: "Utilization will increase but remain within optimal range. No action required.",
      departments: [
        { name: "Sub-Assembly", value: 72 },
        { name: "Final Assembly", value: 78 },
        { name: "Testing", value: 68 }
      ]
    },
    {
      workCenter: "Quality Control",
      currentUtilization: 54,
      forecastedUtilization: 82,
      recommendation: "Increase staffing temporarily",
      riskLevel: "Medium",
      confidence: 87,
      explanation: "Multiple jobs will complete simultaneously, creating inspection bottleneck. Temporary resource allocation recommended.",
      departments: [
        { name: "Inspection", value: 80 },
        { name: "Testing", value: 85 },
        { name: "Documentation", value: 76 }
      ]
    }
  ],
  trends: [
    {
      title: "Resource Efficiency Improving",
      description: "Machine utilization has improved 12% over the last quarter, reducing idle time and increasing throughput.",
      recommendation: "Maintain current scheduling algorithm",
      keyFactors: "Improved setup procedures, optimized job sequencing",
      type: "success"
    },
    {
      title: "Increasing Material Lead Times",
      description: "Supply chain data indicates 15% longer lead times for critical materials from primary vendors.",
      recommendation: "Adjust purchase order timing and consider secondary suppliers",
      keyFactors: "Global supply chain disruptions, transportation delays",
      type: "warning"
    },
    {
      title: "Recurring Quality Issues - Precision Components",
      description: "Pattern of quality issues detected with precision machined components when production volume exceeds 85% capacity.",
      recommendation: "Adjust production scheduling to prevent exceeding 85% capacity in precision work centers",
      keyFactors: "Equipment heat dissipation, operator fatigue",
      type: "warning"
    }
  ]
};

interface ForecastMetricCardProps {
  title: string;
  value: string;
  change: {
    value: string;
    label: string;
    trend: "up" | "down";
  };
}

function ForecastMetricCard({ title, value, change }: ForecastMetricCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="mt-1 flex items-center text-xs">
          {change.trend === "up" ? (
            <ArrowUpRight className="mr-1 h-3 w-3 text-emerald-500" />
          ) : (
            <ArrowDownRight className="mr-1 h-3 w-3 text-red-500" />
          )}
          <span className={change.trend === "up" ? "text-emerald-500" : "text-red-500"}>
            {change.value}
          </span>
          <span className="text-muted-foreground ml-1">{change.label}</span>
        </div>
      </CardContent>
    </Card>
  );
}

interface JobForecastCardProps {
  jobId: string;
  description: string;
  status: string;
  completionDate: string;
  confidence: number;
  risk: string;
  recommendation: string;
  explanation: string;
}

function JobForecastCard({
  jobId,
  description,
  status,
  completionDate,
  confidence,
  risk,
  recommendation,
  explanation
}: JobForecastCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{jobId}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Badge variant={
            risk === "Low" ? "outline" :
              risk === "Medium" ? "secondary" :
                "destructive"
          }>
            {risk} Risk
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="font-medium">{status}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Completion Date</p>
            <p className="font-medium">{completionDate}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Confidence</p>
            <div className="flex items-center gap-2">
              <Progress value={confidence} className="h-2" />
              <span className="text-sm">{confidence}%</span>
            </div>
          </div>
        </div>

        <div className="mb-1">
          <p className="text-xs text-muted-foreground">Recommendation</p>
          <p className="font-medium">{recommendation}</p>
        </div>

        {expanded && (
          <div className="mt-3 text-sm">
            <p className="text-xs text-muted-foreground mb-1">Explanation</p>
            <p>{explanation}</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-0">
        <Button
          variant="ghost"
          size="sm"
          className="w-full flex items-center justify-center"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show Less" : "Show More"}
          <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </Button>
      </CardFooter>
    </Card>
  );
}

interface WorkloadAnalysisCardProps {
  workCenter: string;
  currentUtilization: number;
  forecastedUtilization: number;
  recommendation: string;
  riskLevel: string;
  confidence: number;
  explanation: string;
  departments: Array<{ name: string; value: number }>;
}

function WorkloadAnalysisCard({
  workCenter,
  currentUtilization,
  forecastedUtilization,
  recommendation,
  riskLevel,
  confidence,
  explanation,
  departments
}: WorkloadAnalysisCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getUtilizationColor = (value: number) => {
    if (value >= 90) return "text-red-500";
    if (value >= 75) return "text-amber-500";
    return "text-emerald-500";
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{workCenter}</CardTitle>
          <Badge variant={
            riskLevel === "Low" ? "outline" :
              riskLevel === "Medium" ? "secondary" :
                "destructive"
          }>
            {riskLevel} Risk
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-muted-foreground">Current Utilization</p>
            <div className="flex items-center gap-2">
              <Progress
                value={currentUtilization}
                className="h-2"
              />
              <span className={`text-sm font-medium ${getUtilizationColor(currentUtilization)}`}>
                {currentUtilization}%
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Forecasted Utilization</p>
            <div className="flex items-center gap-2">
              <Progress
                value={forecastedUtilization}
                className="h-2"
              />
              <span className={`text-sm font-medium ${getUtilizationColor(forecastedUtilization)}`}>
                {forecastedUtilization}%
              </span>
            </div>
          </div>
        </div>

        <div className="mb-1">
          <p className="text-xs text-muted-foreground">Recommendation</p>
          <p className="font-medium">{recommendation}</p>
        </div>

        {expanded && (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-1">Department Utilization</p>
            <div className="space-y-2">
              {departments.map((dept) => (
                <div key={dept.name} className="grid grid-cols-6 gap-2 items-center">
                  <span className="col-span-2 text-sm">{dept.name}</span>
                  <Progress
                    value={dept.value}
                    className="h-2 col-span-3"
                  />
                  <span className={`text-sm font-medium ${getUtilizationColor(dept.value)}`}>
                    {dept.value}%
                  </span>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground mt-4 mb-1">Analysis</p>
            <p className="text-sm">{explanation}</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-0">
        <Button
          variant="ghost"
          size="sm"
          className="w-full flex items-center justify-center"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show Less" : "Show More"}
          <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </Button>
      </CardFooter>
    </Card>
  );
}

interface TrendInsightCardProps {
  title: string;
  description: string;
  recommendation?: string;
  keyFactors?: string;
  type: "info" | "success" | "warning";
}

function TrendInsightCard({
  title,
  description,
  recommendation,
  keyFactors,
  type
}: TrendInsightCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getIconByType = () => {
    switch (type) {
      case "info": return <Info className="h-5 w-5 text-blue-500" />;
      case "success": return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "warning": return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      default: return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  return (
    <Card className={`mb-4 border-l-4 ${type === "info" ? "border-l-blue-500" :
      type === "success" ? "border-l-green-500" :
        "border-l-amber-500"
      }`}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          {getIconByType()}
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <p className="text-sm">{description}</p>

        {expanded && recommendation && (
          <div className="mt-3 border-t pt-3">
            <p className="text-xs text-muted-foreground mb-1">Recommendation</p>
            <p className="text-sm">{recommendation}</p>

            {keyFactors && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-1">Key Factors</p>
                <p className="text-sm">{keyFactors}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
      {(recommendation || keyFactors) && (
        <CardFooter className="pt-0">
          <Button
            variant="ghost"
            size="sm"
            className="w-full flex items-center justify-center"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Show Less" : "Show More"}
            <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

export default function Forecasting() {
  const [activeTab, setActiveTab] = useState("overview");

  const { data: jobsData = [], isLoading: isLoadingJobs } = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      try {
        return await db.getJobs();
      } catch (error) {
        console.error("Error fetching jobs:", error);
        return [];
      }
    }
  });

  const { data: workCentersData = [], isLoading: isLoadingWorkCenters } = useQuery({
    queryKey: ["workCenters"],
    queryFn: async () => {
      try {
        return await db.getWorkCenters();
      } catch (error) {
        console.error("Error fetching work centers:", error);
        return [];
      }
    }
  });

  if (isLoadingJobs || isLoadingWorkCenters) {
    return (
      <DashboardLayout>
        <div className="container mx-auto py-8">
          <LoadingSpinner message="Loading forecast data..." />
        </div>
      </DashboardLayout>
    );
  }

  // Sample data for charts
  const jobCompletionData = [
    { month: 'Jan', forecast: 12, actual: 10 },
    { month: 'Feb', forecast: 15, actual: 14 },
    { month: 'Mar', forecast: 18, actual: 16 },
    { month: 'Apr', forecast: 20, actual: 19 },
    { month: 'May', forecast: 23, actual: null },
    { month: 'Jun', forecast: 26, actual: null },
  ];

  const utilizationData = [
    { workCenter: 'CNC', current: 85, forecast: 92 },
    { workCenter: 'Assembly', current: 68, forecast: 75 },
    { workCenter: 'QC', current: 54, forecast: 82 },
    { workCenter: 'Paint', current: 72, forecast: 68 },
    { workCenter: 'Testing', current: 60, forecast: 78 },
  ];

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-1">Production Forecasting</h1>
            <p className="text-muted-foreground">
              AI-powered production metrics and forecasted outcomes
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex gap-2">
            <Button variant="outline" size="sm" className="gap-1">
              <Calendar className="h-4 w-4" />
              Last 30 Days
            </Button>
            <Button variant="outline" size="sm" className="gap-1">
              <Calculator className="h-4 w-4" />
              Recalculate
            </Button>
          </div>
        </div>

        {/* Date range and view toggles */}
        <Card className="mb-6 p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
              <span className="text-sm font-medium">Date Range</span>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  className="w-[160px]"
                  defaultValue="2025-04-01"
                />
                <span>to</span>
                <Input
                  type="date"
                  className="w-[160px]"
                  defaultValue="2025-04-30"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Search job, part, or center..."
                className="md:w-[300px]"
              />
              <div className="flex">
                <Button className="rounded-r-none bg-blue-500 hover:bg-blue-600">Weekly View</Button>
                <Button variant="outline" className="rounded-l-none">Daily View</Button>
              </div>
              <Button variant="outline">Jobs</Button>
              <Button variant="outline">Work Centers</Button>
            </div>
          </div>
        </Card>

        {/* Production metrics cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
          <Card className="border-l-4 border-l-cyan-500">
            <CardContent className="p-6 flex flex-col items-center text-center">
              <div className="mb-3 bg-cyan-100 p-3 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-cyan-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <rect x="5" y="9" width="3" height="6" />
                  <rect x="10.5" y="9" width="3" height="6" />
                  <rect x="16" y="9" width="3" height="6" />
                </svg>
              </div>
              <h3 className="font-medium text-sm text-muted-foreground uppercase mb-1">Hours This Week</h3>
              <p className="text-3xl font-bold mb-1">5520.0</p>
              <p className="text-xs text-muted-foreground">Projected workload</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-6 flex flex-col items-center text-center">
              <div className="mb-3 bg-amber-100 p-3 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <line x1="12" y1="4" x2="12" y2="20" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                </svg>
              </div>
              <h3 className="font-medium text-sm text-muted-foreground uppercase mb-1">Avg Hrs / Day</h3>
              <p className="text-3xl font-bold mb-1">145.3</p>
              <p className="text-xs text-muted-foreground">This Week's Daily Need</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-6 flex flex-col items-center text-center">
              <div className="mb-3 bg-amber-100 p-3 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18" />
                  <path d="M18 9l-6-6-6 6" />
                  <path d="M6 9v4" />
                  <path d="M12 3v10" />
                  <path d="M18 9v8" />
                </svg>
              </div>
              <h3 className="font-medium text-sm text-muted-foreground uppercase mb-1">Avg Hrs / Week</h3>
              <p className="text-3xl font-bold mb-1">726.3</p>
              <p className="text-xs text-muted-foreground">Based on current jobs</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-6 flex flex-col items-center text-center">
              <div className="mb-3 bg-blue-100 p-3 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v6" />
                  <path d="M12 18v4" />
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="1" />
                  <path d="M7 12h4" />
                </svg>
              </div>
              <h3 className="font-medium text-sm text-muted-foreground uppercase mb-1">Avg Days to Due</h3>
              <p className="text-3xl font-bold mb-1">1.8</p>
              <p className="text-xs text-muted-foreground">Across All Jobs</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-6 flex flex-col items-center text-center">
              <div className="mb-3 bg-red-100 p-3 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <h3 className="font-medium text-sm text-muted-foreground uppercase mb-1">At-Risk Jobs</h3>
              <p className="text-3xl font-bold mb-1">0</p>
              <p className="text-xs text-muted-foreground">Heavy workload + tight due date</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-6 flex flex-col items-center text-center">
              <div className="mb-3 bg-green-100 p-3 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 12l2 2 4-4" />
                  <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                </svg>
              </div>
              <h3 className="font-medium text-sm text-muted-foreground uppercase mb-1">Suggested Shift Plan</h3>
              <p className="text-2xl font-bold mb-1">12-Hour Days</p>
              <p className="text-xl font-bold">Needed</p>
              <p className="text-xs text-muted-foreground">To meet demand</p>
            </CardContent>
          </Card>
        </div>

        {/* Original forecast metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <ForecastMetricCard
            title="Forecasted Jobs"
            value={forecastData.summary.jobsForecasted.toString()}
            change={{
              value: "+5",
              label: "from last month",
              trend: "up"
            }}
          />
          <ForecastMetricCard
            title="On-Time Delivery"
            value={`${forecastData.summary.onTimeDelivery}%`}
            change={{
              value: "+2.4%",
              label: "from last month",
              trend: "up"
            }}
          />
          <ForecastMetricCard
            title="Resource Utilization"
            value={`${forecastData.summary.resourceUtilization}%`}
            change={{
              value: "+3.2%",
              label: "from last month",
              trend: "up"
            }}
          />
          <ForecastMetricCard
            title="Cost Variance"
            value={`${forecastData.summary.costVariance}%`}
            change={{
              value: "-1.5%",
              label: "from last month",
              trend: "down"
            }}
          />
        </div>

        <Tabs
          defaultValue="overview"
          value={activeTab}
          onValueChange={setActiveTab}
          className="mb-6"
        >
          <TabsList className="grid grid-cols-4 w-full md:w-auto mb-6">
            <TabsTrigger value="overview" className="gap-1">
              <LineChartIcon className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="jobs" className="gap-1">
              <Calendar className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Job Forecasts</span>
            </TabsTrigger>
            <TabsTrigger value="workload" className="gap-1">
              <BarChart3 className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Workload Analysis</span>
            </TabsTrigger>
            <TabsTrigger value="trends" className="gap-1">
              <TrendingUp className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Trend Insights</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Job Completion Forecast</CardTitle>
                  <CardDescription>
                    Forecasted vs. actual job completions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={jobCompletionData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="forecast"
                          stroke="#8884d8"
                          strokeWidth={2}
                          activeDot={{ r: 8 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="actual"
                          stroke="#82ca9d"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Work Center Utilization</CardTitle>
                  <CardDescription>
                    Current vs. forecasted utilization
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={utilizationData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="workCenter" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="current" fill="#8884d8" name="Current" />
                        <Bar dataKey="forecast" fill="#82ca9d" name="Forecast" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Key Insights</CardTitle>
                  <CardDescription>
                    AI-detected patterns and recommendations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {forecastData.trends.map((trend, index) => (
                      <TrendInsightCard
                        key={index}
                        title={trend.title}
                        description={trend.description}
                        recommendation={trend.recommendation}
                        keyFactors={trend.keyFactors}
                        type={trend.type as "info" | "success" | "warning"}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="jobs">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {forecastData.jobs.map((job) => (
                <JobForecastCard
                  key={job.jobId}
                  jobId={job.jobId}
                  description={job.description}
                  status={job.status}
                  completionDate={job.completionDate}
                  confidence={job.confidence}
                  risk={job.risk}
                  recommendation={job.recommendation}
                  explanation={job.explanation}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="workload">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {forecastData.workCenters.map((wc) => (
                <WorkloadAnalysisCard
                  key={wc.workCenter}
                  workCenter={wc.workCenter}
                  currentUtilization={wc.currentUtilization}
                  forecastedUtilization={wc.forecastedUtilization}
                  recommendation={wc.recommendation}
                  riskLevel={wc.riskLevel}
                  confidence={wc.confidence}
                  explanation={wc.explanation}
                  departments={wc.departments}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="trends">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {forecastData.trends.map((trend, index) => (
                <TrendInsightCard
                  key={index}
                  title={trend.title}
                  description={trend.description}
                  recommendation={trend.recommendation}
                  keyFactors={trend.keyFactors}
                  type={trend.type as "info" | "success" | "warning"}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}