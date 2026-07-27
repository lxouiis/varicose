import { useMemo } from "react";
import { useStore } from "@/store/useStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from "recharts";
import { Users, Activity, TrendingUp, AlertCircle } from "lucide-react";

const CEAP_ORDER = ["C0", "C1", "C2", "C3", "C4a", "C4b", "C5", "C6"];

const getCeapLevel = (ceap: string = "") => {
  if (ceap.includes("C6")) return 7;
  if (ceap.includes("C5")) return 6;
  if (ceap.includes("C4b")) return 5;
  if (ceap.includes("C4a")) return 4;
  if (ceap.includes("C4")) return 4;
  if (ceap.includes("C3")) return 3;
  if (ceap.includes("C2")) return 2;
  if (ceap.includes("C1")) return 1;
  return 0;
};

const getCeapColor = (cLevel: number) => {
  if (cLevel === 7) return "#dc2626"; // C6 red
  if (cLevel >= 4) return "#ea580c"; // C4/C5 orange
  if (cLevel === 3) return "#ca8a04"; // C3 yellow
  if (cLevel > 0) return "#16a34a"; // C1/C2 green
  return "#6b7280"; // C0 gray
};

export function AnalyticsTab() {
  const patients = useStore(s => s.patients);
  const assessments = useStore(s => s.assessments);

  const stats = useMemo(() => {
    if (patients.length === 0) return null;

    // Highest CEAP per patient
    const patientHighestCeap: Record<string, number> = {};
    const patientLatestRvcss: Record<string, number> = {};
    const patientMaxCLevelAllTime: Record<string, number> = {};

    patients.forEach(p => {
      const pAssessments = assessments.filter(a => a.patientId === p.id).sort((a,b) => new Date(b.assessmentDate).getTime() - new Date(a.assessmentDate).getTime());
      
      let maxCL = 0;
      pAssessments.forEach(a => {
        const rightC = getCeapLevel(a.rightLeg.ceapTotal);
        const leftC = getCeapLevel(a.leftLeg.ceapTotal);
        maxCL = Math.max(maxCL, rightC, leftC);
      });
      patientHighestCeap[p.id] = maxCL;
      patientMaxCLevelAllTime[p.id] = maxCL;

      if (pAssessments.length > 0) {
        patientLatestRvcss[p.id] = pAssessments[0].globalRvcssTotal;
      }
    });

    // 1. CEAP Distribution
    const ceapCounts = Array(8).fill(0);
    Object.values(patientHighestCeap).forEach(lvl => ceapCounts[lvl]++);
    const ceapData = CEAP_ORDER.map((name, i) => ({
      name,
      count: ceapCounts[i],
      color: getCeapColor(i)
    }));

    // Most Common CEAP
    let mostCommonCeapIndex = 0;
    let maxCeapCount = -1;
    ceapCounts.forEach((count, i) => {
      if (count > maxCeapCount) {
        maxCeapCount = count;
        mostCommonCeapIndex = i;
      }
    });

    // C4+ percentage
    const c4PlusCount = Object.values(patientMaxCLevelAllTime).filter(lvl => lvl >= 4).length;
    const c4PlusPercent = patients.length > 0 ? Math.round((c4PlusCount / patients.length) * 100) : 0;

    // 2. rVCSS Ranges
    const rvcssRanges = [
      { name: "0-5", count: 0 },
      { name: "6-10", count: 0 },
      { name: "11-15", count: 0 },
      { name: "16-20", count: 0 },
      { name: "21-25", count: 0 },
      { name: "26-30", count: 0 },
    ];
    let totalRvcss = 0;
    let rvcssPatientCount = 0;
    Object.values(patientLatestRvcss).forEach(score => {
      totalRvcss += score;
      rvcssPatientCount++;
      if (score <= 5) rvcssRanges[0].count++;
      else if (score <= 10) rvcssRanges[1].count++;
      else if (score <= 15) rvcssRanges[2].count++;
      else if (score <= 20) rvcssRanges[3].count++;
      else if (score <= 25) rvcssRanges[4].count++;
      else rvcssRanges[5].count++;
    });
    const avgRvcss = rvcssPatientCount > 0 ? (totalRvcss / rvcssPatientCount).toFixed(1) : "0";

    // 3. Cases Over Time
    const dateCounts: Record<string, number> = {};
    assessments.forEach(a => {
      const date = a.assessmentDate;
      dateCounts[date] = (dateCounts[date] || 0) + 1;
    });
    const timelineData = Object.entries(dateCounts)
      .sort((a,b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));

    // 4. Clinical Findings
    const signCounts: Record<string, number> = {};
    assessments.forEach(a => {
      const allSigns = [...new Set([...a.rightLeg.clinicalSigns, ...a.leftLeg.clinicalSigns])];
      allSigns.forEach(s => {
        signCounts[s] = (signCounts[s] || 0) + 1;
      });
    });
    const clinicalData = Object.entries(signCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a,b) => b.count - a.count)
      .slice(0, 7); // Top 7

    return {
      ceapData,
      rvcssRanges,
      timelineData,
      clinicalData,
      avgRvcss,
      mostCommonCeap: CEAP_ORDER[mostCommonCeapIndex],
      c4PlusPercent
    };
  }, [patients, assessments]);

  if (patients.length === 0 || !stats) {
    return (
      <Card className="border-dashed bg-slate-50 mt-8 w-full p-12 text-center">
        <CardContent className="pt-6">
          <Activity className="mx-auto h-12 w-12 text-slate-300 mb-4" />
          <p className="text-lg font-medium text-slate-900">No data yet</p>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
            Load seed data or add patients to see analytics.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 mt-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{patients.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average rVCSS Score</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgRvcss}</div>
            <p className="text-xs text-muted-foreground">across latest assessments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Most Common CEAP</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.mostCommonCeap}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">C4+ Cases</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.c4PlusPercent}%</div>
            <p className="text-xs text-muted-foreground">of total patients</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Chart 1: CEAP Distribution */}
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-lg">CEAP Class Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.ceapData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {stats.ceapData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Chart 2: rVCSS Range */}
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-lg">Global rVCSS Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.rvcssRanges} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="count" fill="#1a6b5c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Chart 3: Over Time */}
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-lg">Daily Assessment Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(str) => {
                    if (!str) return "";
                    const parts = str.split("-");
                    return parts.length === 3 ? `${parts[1]}/${parts[2]}` : str;
                  }} />
                  <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Line type="monotone" dataKey="count" stroke="#1a6b5c" strokeWidth={3} dot={{ r: 4, fill: '#1a6b5c', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Chart 4: Clinical Findings */}
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-lg">Clinical Findings Frequency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.clinicalData} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" fontSize={11} tickLine={false} axisLine={false} width={100} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="count" fill="#1a6b5c" radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
