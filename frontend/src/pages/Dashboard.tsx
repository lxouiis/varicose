import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Users, FileText, AlertTriangle, Clock, Bug } from "lucide-react";
import { useStore } from "@/store/useStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AnalyticsTab } from "@/components/dashboard/AnalyticsTab";

export function Dashboard() {
  const navigate = useNavigate();
  const patients = useStore((state) => state.patients);
  const assessments = useStore((state) => state.assessments);
  const currentUser = useStore((state) => state.currentUser);
  const fetchPatients = useStore((state) => state.fetchPatients);
  const getTodayAssessment = useStore((state) => state.getTodayAssessment);
  const [activeTab, setActiveTab] = useState<"patients" | "analytics">("patients");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // Duplicate assessment dialog state
  const [dupDialog, setDupDialog] = useState<{ patientId: string; existingId: string } | null>(null);

  const filteredPatients = patients.filter(
    (p) =>
      p.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.uhid.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPatients = patients.length;
  const today = new Date().toISOString().split("T")[0];
  const assessmentsToday = assessments.filter(
    (a) => a.assessmentDate === today || a.createdAt.startsWith(today)
  ).length;

  const getLastAssessment = (patientId: string) => {
    const patientAssessments = assessments.filter(a => a.patientId === patientId);
    if (patientAssessments.length === 0) return null;
    return patientAssessments.sort((a, b) => new Date(b.assessmentDate).getTime() - new Date(a.assessmentDate).getTime())[0];
  };

  // C4+ cases count — use patient-level CEAP from backend
  const c4PlusCases = patients.filter(p => {
    const r = p.ceapRight || '';
    const l = p.ceapLeft || '';
    return r.match(/C[4-6]/) || l.match(/C[4-6]/);
  }).length;

  const pendingReview = 0;

  const getSeverityColor = (ceap: string = "") => {
    if (ceap.includes("C6")) return "bg-[#dc2626] text-white font-bold hover:bg-[#dc2626]";
    if (ceap.includes("C5")) return "bg-[#ea580c] text-white font-bold hover:bg-[#ea580c]";
    if (ceap.includes("C4")) return "bg-[#ea580c] text-white font-bold hover:bg-[#ea580c]";
    if (ceap.includes("C3")) return "bg-[#ca8a04] text-white font-bold hover:bg-[#ca8a04]";
    if (ceap.includes("C2") || ceap.includes("C1")) return "bg-[#16a34a] text-white font-bold hover:bg-[#16a34a]";
    return "bg-[#6b7280] text-white font-bold hover:bg-[#6b7280]";
  };

  const handleNewExam = (patientId: string) => {
    const existing = getTodayAssessment(patientId);
    if (existing) {
      setDupDialog({ patientId, existingId: existing.id });
    } else {
      navigate(`/assessment/new/${patientId}`);
    }
  };

  const handleOverwrite = () => {
    if (!dupDialog) return;
    // Delete the existing assessment by overwriting with empty markers, then navigate
    // Simpler: just navigate and the new save will create a new assessment
    // The doctor will fill in new data; we remove the old one
    const { patientId, existingId } = dupDialog;
    // Remove old assessment by setting a flag or filtering
    const current = useStore.getState().assessments.filter(a => a.id !== existingId);
    useStore.setState({ assessments: current });
    setDupDialog(null);
    navigate(`/assessment/new/${patientId}`);
  };

  const handleCreateNew = () => {
    if (!dupDialog) return;
    setDupDialog(null);
    navigate(`/assessment/new/${dupDialog.patientId}`);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">
            Welcome back, {currentUser?.name ?? 'Doctor'}
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's what's happening in your clinic today.
          </p>
        </div>
        <div className="flex gap-2">
          {import.meta.env.DEV && (
            <Button variant="outline" size="lg" onClick={() => useStore.getState().auditData()}>
              <Bug className="mr-2 h-4 w-4" /> Audit Data
            </Button>
          )}
          <Button variant="outline" size="lg" onClick={() => {
            useStore.getState().seedData();
          }}>
            Load Seed Data
          </Button>
        </div>
      </div>
      <div className="border-b border-slate-200 mt-2">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab("patients")}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "patients"
                ? "border-[#1a6b5c] text-[#1a6b5c]"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            Patients
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "analytics"
                ? "border-[#1a6b5c] text-[#1a6b5c]"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            Analytics
          </button>
        </nav>
      </div>

      {activeTab === "analytics" ? (
        <AnalyticsTab />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPatients}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assessments Today</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assessmentsToday}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">C4+ Severe Cases</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{c4PlusCases}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingReview}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
          <CardTitle>Recent Patients</CardTitle>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by name or UHID..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-slate-50 border-b">
                <tr>
                  <th className="px-4 py-3 font-medium">Patient Name</th>
                  <th className="px-4 py-3 font-medium">UHID</th>
                  <th className="px-4 py-3 font-medium">Age/Gender</th>
                  <th className="px-4 py-3 font-medium">Last Visit</th>
                  <th className="px-4 py-3 font-medium">CEAP (R)</th>
                  <th className="px-4 py-3 font-medium">CEAP (L)</th>
                  <th className="px-4 py-3 font-medium">rVCSS</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      No patients found.
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map((patient) => {
                    const lastAssessment = getLastAssessment(patient.id);
                    // Use patient-level CEAP from backend (always available)
                    // Fall back to assessment-level data if loaded
                    const ceapR = patient.ceapRight || lastAssessment?.rightLeg?.ceapTotal || null;
                    const ceapL = patient.ceapLeft || lastAssessment?.leftLeg?.ceapTotal || null;
                    const rvcss = patient.rvcssTotal ?? lastAssessment?.globalRvcssTotal ?? null;
                    return (
                      <tr key={patient.id} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-900">{patient.patientName}</td>
                        <td className="px-4 py-3 font-mono text-xs">{patient.uhid}</td>
                        <td className="px-4 py-3">{patient.age} / {patient.gender.charAt(0)}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {lastAssessment ? lastAssessment.assessmentDate : (ceapR || ceapL ? "Has visits" : "No visits")}
                        </td>
                        <td className="px-4 py-3">
                          {ceapR ? (
                            <Badge className={getSeverityColor(ceapR)} variant="secondary">
                              {ceapR.split(',')[0]}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {ceapL ? (
                            <Badge className={getSeverityColor(ceapL)} variant="secondary">
                              {ceapL.split(',')[0]}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {rvcss != null ? rvcss : "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="outline" size="sm" onClick={() => handleNewExam(patient.id)}>
                            New Exam
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      </>
      )}

      {/* Duplicate assessment dialog */}
      {dupDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Assessment Already Exists</h3>
            <p className="text-sm text-slate-600">
              An assessment for this patient already exists today. Do you want to overwrite it or create a new one?
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => setDupDialog(null)}>Cancel</Button>
              <Button variant="outline" className="border-amber-500 text-amber-600 hover:bg-amber-50" onClick={handleOverwrite}>
                Overwrite
              </Button>
              <Button className="bg-[#1a6b5c] hover:bg-[#134d42]" onClick={handleCreateNew}>
                Create New
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
