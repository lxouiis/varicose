import { useRef, useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStore, type LegExam } from "@/store/useStore";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Printer } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from "recharts";
import { VenousDiagram } from "@/components/ui/venous-diagram";

function getCeapSeverityColor(ceap: string) {
  if (!ceap) return '#6b7280';
  if (ceap.includes('C6')) return '#dc2626';
  if (ceap.includes('C5')) return '#ea580c';
  if (ceap.includes('C4')) return '#ea580c';
  if (ceap.includes('C3')) return '#ca8a04';
  if (ceap.includes('C2') || ceap.includes('C1')) return '#16a34a';
  return '#6b7280';
}

// rVCSS parameter definitions (module-level to avoid re-creation on each render)
const RVCSS_PARAMS: { param: string; field: keyof LegExam }[] = [
  { param: 'Pain',           field: 'pain' },
  { param: 'Varicose Veins', field: 'varicoseVeins' },
  { param: 'Venous Edema',   field: 'venousEdema' },
  { param: 'Pigmentation',   field: 'skinPigmentation' },
  { param: 'Inflammation',   field: 'inflammation' },
  { param: 'Induration',     field: 'induration' },
  { param: 'Ulcer No.',      field: 'ulcerNumber' },
  { param: 'Ulcer Dur.',     field: 'ulcerDuration' },
  { param: 'Ulcer Size',     field: 'ulcerSizeScore' },
  { param: 'Compliance',     field: 'compressionCompliance' },
];

function LegReport({ leg, label }: { leg: LegExam; label: string }) {
  const bgColor = getCeapSeverityColor(leg.ceapTotal);
  return (
    <div className="space-y-5">
      {/* Header: Title + CEAP badge stacked to prevent clipping */}
      <div className="border-b-2 border-slate-800 pb-3 mb-1">
        <h3 className="text-lg font-bold text-slate-800 mb-2">{label} Leg</h3>
        {leg.ceapTotal && (
          <div className="flex items-start gap-2 flex-wrap">
            <span className="text-xs font-medium text-slate-500 mt-0.5 shrink-0">CEAP:</span>
            <span
              className="font-bold font-mono text-xs px-2 py-1 rounded break-all leading-snug"
              style={{ backgroundColor: bgColor, color: '#fff', wordBreak: 'break-word', whiteSpace: 'normal', maxWidth: '100%' }}
            >
              {leg.ceapTotal}
            </span>
          </div>
        )}
      </div>

      {/* Doppler Findings */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#1a6b5c] mb-2 border-b pb-1">Doppler Findings</h4>
        <table className="w-full text-sm text-slate-700">
          <tbody>
            <tr className="border-b border-slate-100"><td className="py-1 font-medium w-48">Common Femoral Vein</td><td className="py-1">{leg.commonFemoralVein || "—"}</td></tr>
            <tr className="border-b border-slate-100"><td className="py-1 font-medium">Superficial Femoral Vein</td><td className="py-1">{leg.superficialFemoralVein || "—"}</td></tr>
            <tr className="border-b border-slate-100"><td className="py-1 font-medium">Popliteal Vein</td><td className="py-1">{leg.poplitealVeinStatus || "—"}</td></tr>
            <tr className="border-b border-slate-100"><td className="py-1 font-medium">SFJ Reflux</td><td className="py-1">{leg.sfjReflux ? "Yes" : "No"}</td></tr>
            <tr className="border-b border-slate-100"><td className="py-1 font-medium">GSV Diameter</td><td className="py-1">{leg.gsvDiamMm ? `${leg.gsvDiamMm} mm` : "—"}</td></tr>
            <tr className="border-b border-slate-100"><td className="py-1 font-medium">SSV Diameter</td><td className="py-1">{leg.ssvDiamMm ? `${leg.ssvDiamMm} mm` : "—"}</td></tr>
            <tr className="border-b border-slate-100"><td className="py-1 font-medium">Etiology (E)</td><td className="py-1">{leg.etiology ? `E${leg.etiology}` : "—"}</td></tr>
            <tr><td className="py-1 font-medium">Incompetent Perforators</td><td className="py-1">{leg.incompetentPerforators ? "Yes" : "No"}</td></tr>
          </tbody>
        </table>
      </div>

      {/* Clinical Signs & Local Exam */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#1a6b5c] mb-2 border-b pb-1">Clinical Signs & Local Exam</h4>
        <table className="w-full text-sm text-slate-700">
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="py-1 font-medium w-48">Clinical Signs</td>
              <td className="py-1">{leg.clinicalSigns.length ? leg.clinicalSigns.join(", ") : "None"}</td>
            </tr>
            <tr className="border-b border-slate-100"><td className="py-1 font-medium">Skin</td><td className="py-1">{leg.skin}</td></tr>
            <tr className="border-b border-slate-100"><td className="py-1 font-medium">Swelling Grade</td><td className="py-1">{leg.swelling} / 3</td></tr>
            {leg.ulcerPresent && (
              <>
                <tr className="border-b border-slate-100"><td className="py-1 font-medium">Ulcer Present</td><td className="py-1 text-red-600 font-semibold">Yes</td></tr>
                {leg.ulcerLocationText && <tr className="border-b border-slate-100"><td className="py-1 font-medium pl-4">Location</td><td className="py-1">{leg.ulcerLocationText}</td></tr>}
                {leg.ulcerSizeCm != null && <tr className="border-b border-slate-100"><td className="py-1 font-medium pl-4">Size</td><td className="py-1">{leg.ulcerSizeCm} cm</td></tr>}
                {leg.ulcerType && <tr className="border-b border-slate-100"><td className="py-1 font-medium pl-4">Type</td><td className="py-1">{leg.ulcerType}</td></tr>}
                {leg.ulcerEdges && <tr className="border-b border-slate-100"><td className="py-1 font-medium pl-4">Edges</td><td className="py-1">{leg.ulcerEdges}</td></tr>}
                {leg.ulcerBase && <tr className="border-b border-slate-100"><td className="py-1 font-medium pl-4">Base</td><td className="py-1">{leg.ulcerBase}</td></tr>}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AssessmentReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const assessments = useStore(state => state.assessments);
  const getPatientById = useStore(state => state.getPatientById);
  const getAssessmentsByPatientId = useStore(state => state.getAssessmentsByPatientId);
  const fetchPatients = useStore(state => state.fetchPatients);
  const reportRef = useRef<HTMLDivElement>(null);

  const assessment = assessments.find(a => a.id === id);
  const patient = assessment ? getPatientById(assessment.patientId) : null;

  // Find the previous visit for this patient (chronologically before this assessment)
  const previousAssessment = useMemo(() => {
    if (!assessment) return null;
    const patientAssessments = getAssessmentsByPatientId(assessment.patientId)
      .filter(a => a.id !== assessment.id)
      .sort((a, b) => new Date(b.assessmentDate).getTime() - new Date(a.assessmentDate).getTime());
    // Most recent assessment before the current one
    return patientAssessments.find(a =>
      new Date(a.assessmentDate).getTime() < new Date(assessment.assessmentDate).getTime()
    ) || patientAssessments[0] || null;
  }, [assessment, getAssessmentsByPatientId]);

  // Previous vs Current comparison (computed before early return to satisfy hooks rules)
  const visitComparisonData = useMemo(() => {
    if (!previousAssessment || !assessment) return null;
    return RVCSS_PARAMS
      .map(({ param, field }) => {
        const prevRight = (previousAssessment.rightLeg[field] as number) || 0;
        const prevLeft  = (previousAssessment.leftLeg[field] as number)  || 0;
        const currRight = (assessment.rightLeg[field] as number) || 0;
        const currLeft  = (assessment.leftLeg[field] as number)  || 0;
        const prev = prevRight + prevLeft;
        const curr = currRight + currLeft;
        return { param, prev, curr, delta: curr - prev };
      })
      .filter(row => row.prev !== row.curr);
  }, [previousAssessment, assessment]);

  const allChangesData = useMemo(() => {
    if (!previousAssessment || !assessment) return null;
    const changes: { category: string; param: string; prev: string; curr: string }[] = [];

    const addDiff = (category: string, param: string, pVal: any, cVal: any) => {
      let pStr = pVal == null || pVal === '' ? '—' : String(pVal);
      let cStr = cVal == null || cVal === '' ? '—' : String(cVal);
      if (typeof pVal === 'boolean') pStr = pVal ? 'Yes' : 'No';
      if (typeof cVal === 'boolean') cStr = cVal ? 'Yes' : 'No';
      if (pStr !== cStr) {
        changes.push({ category, param, prev: pStr, curr: cStr });
      }
    };

    const addArrayDiff = (category: string, param: string, pArr: string[], cArr: string[]) => {
      const pStr = (pArr || []).slice().sort().join(', ') || 'None';
      const cStr = (cArr || []).slice().sort().join(', ') || 'None';
      if (pStr !== cStr) {
        changes.push({ category, param, prev: pStr, curr: cStr });
      }
    };

    // General & History
    addArrayDiff('History', 'Comorbidities', previousAssessment.comorbidities, assessment.comorbidities);
    addArrayDiff('History', 'Venous History', previousAssessment.venousHistory, assessment.venousHistory);
    addDiff('General Exam', 'Blood Pressure', previousAssessment.bloodPressure, assessment.bloodPressure);
    addDiff('General Exam', 'Pulse Rate', previousAssessment.pulseRate, assessment.pulseRate);
    addArrayDiff('General Exam', 'General Signs', previousAssessment.generalSigns, assessment.generalSigns);
    addDiff('PROMs', 'Right Pain VAS', previousAssessment.rightPainVas, assessment.rightPainVas);
    addDiff('PROMs', 'Left Pain VAS', previousAssessment.leftPainVas, assessment.leftPainVas);

    // Leg Exams
    const legFields: { key: keyof LegExam; label: string }[] = [
      { key: 'skin', label: 'Skin Changes' },
      { key: 'swelling', label: 'Swelling Grade' },
      { key: 'ulcerPresent', label: 'Ulcer Present' },
      { key: 'ulcerLocationText', label: 'Ulcer Location' },
      { key: 'ulcerSizeCm', label: 'Ulcer Size (cm)' },
      { key: 'ulcerType', label: 'Ulcer Type' },
      { key: 'ulcerEdges', label: 'Ulcer Edges' },
      { key: 'ulcerBase', label: 'Ulcer Base' },
      { key: 'deepSystem', label: 'Deep System' },
      { key: 'sfjReflux', label: 'SFJ Reflux' },
      { key: 'gsvDiamMm', label: 'GSV Diameter (mm)' },
      { key: 'ssvDiamMm', label: 'SSV Diameter (mm)' },
      { key: 'incompetentPerforators', label: 'Incompetent Perforators' },
      { key: 'commonFemoralVein', label: 'Common Femoral Vein' },
      { key: 'superficialFemoralVein', label: 'Superficial Femoral Vein' },
      { key: 'poplitealVeinStatus', label: 'Popliteal Vein' },
      { key: 'etiology', label: 'Etiology' },
      { key: 'ceapTotal', label: 'CEAP Class' },
      { key: 'rvcssTotal', label: 'rVCSS Total' },
      { key: 'pain', label: 'rVCSS Pain' },
      { key: 'varicoseVeins', label: 'rVCSS Varicose Veins' },
      { key: 'venousEdema', label: 'rVCSS Venous Edema' },
      { key: 'skinPigmentation', label: 'rVCSS Pigmentation' },
      { key: 'inflammation', label: 'rVCSS Inflammation' },
      { key: 'induration', label: 'rVCSS Induration' },
      { key: 'ulcerNumber', label: 'rVCSS Ulcer Number' },
      { key: 'ulcerDuration', label: 'rVCSS Ulcer Duration' },
      { key: 'ulcerSizeScore', label: 'rVCSS Ulcer Size Score' },
      { key: 'compressionCompliance', label: 'rVCSS Compliance' },
    ];

    ['rightLeg', 'leftLeg'].forEach(legKey => {
      const pLeg = previousAssessment[legKey as 'rightLeg' | 'leftLeg'];
      const cLeg = assessment[legKey as 'rightLeg' | 'leftLeg'];
      const cat = legKey === 'rightLeg' ? 'Right Leg' : 'Left Leg';

      addArrayDiff(cat, 'Clinical Signs', pLeg.clinicalSigns, cLeg.clinicalSigns);

      legFields.forEach(f => {
        addDiff(cat, f.label, pLeg[f.key], cLeg[f.key]);
      });
    });

    return changes;
  }, [previousAssessment, assessment]);

  useEffect(() => {
    if (assessments.length > 0 && !getPatientById(assessments[0].patientId)) {
      fetchPatients();
    }
  }, [id, assessment, fetchPatients, assessments]);

  if (!assessment || !patient) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="text-muted-foreground">Loading assessment data...</div>
        <Button variant="outline" onClick={() => navigate("/")}>Back to Dashboard</Button>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleDownload = async () => {
    if (!reportRef.current) return;
    const previousScrollY = window.scrollY;
    try {
      setIsGeneratingPdf(true);
      window.scrollTo(0, 0);
      // Let charts render completely and layout update
      await new Promise(r => setTimeout(r, 500));

      const pdf = new jsPDF("p", "mm", "a4");
      const pages = reportRef.current.querySelectorAll('.pdf-page');

      if (pages.length > 0) {
        for (let i = 0; i < pages.length; i++) {
          const page = pages[i] as HTMLElement;
          // Scroll the element into view so html2canvas doesn't clip offscreen parts
          window.scrollTo(0, page.offsetTop);
          
          const canvas = await html2canvas(page, { 
            scale: 2, 
            useCORS: true, 
            logging: false
          });
          const imgData = canvas.toDataURL("image/jpeg", 0.7);
          
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const imgHeight = (canvas.height * pdfWidth) / canvas.width;

          if (i > 0) pdf.addPage();
          pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, imgHeight);
        }
      } else {
        const canvas = await html2canvas(reportRef.current, { 
          scale: 2, 
          useCORS: true, 
          logging: false
        });
        const imgData = canvas.toDataURL("image/jpeg", 0.7);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;

        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
          position -= pageHeight;
          pdf.addPage();
          pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, imgHeight);
          heightLeft -= pageHeight;
        }
      }

      pdf.save(`CEVI_Report_${patient.patientName.replace(/\s+/g, '_')}_${assessment.assessmentDate}.pdf`);
    } catch (err) {
      console.error("PDF generation failed", err);
    } finally {
      setIsGeneratingPdf(false);
      window.scrollTo(0, previousScrollY);
    }
  };

  const rvcssData = [
    { subject: 'Pain', right: assessment.rightLeg.pain || 0, left: assessment.leftLeg.pain || 0, fullMark: 3 },
    { subject: 'Varicose Veins', right: assessment.rightLeg.varicoseVeins || 0, left: assessment.leftLeg.varicoseVeins || 0, fullMark: 3 },
    { subject: 'Venous Edema', right: assessment.rightLeg.venousEdema || 0, left: assessment.leftLeg.venousEdema || 0, fullMark: 3 },
    { subject: 'Pigmentation', right: assessment.rightLeg.skinPigmentation || 0, left: assessment.leftLeg.skinPigmentation || 0, fullMark: 3 },
    { subject: 'Inflammation', right: assessment.rightLeg.inflammation || 0, left: assessment.leftLeg.inflammation || 0, fullMark: 3 },
    { subject: 'Induration', right: assessment.rightLeg.induration || 0, left: assessment.leftLeg.induration || 0, fullMark: 3 },
    { subject: 'Ulcer No.', right: assessment.rightLeg.ulcerNumber || 0, left: assessment.leftLeg.ulcerNumber || 0, fullMark: 3 },
    { subject: 'Ulcer Dur.', right: assessment.rightLeg.ulcerDuration || 0, left: assessment.leftLeg.ulcerDuration || 0, fullMark: 3 },
    { subject: 'Ulcer Size', right: assessment.rightLeg.ulcerSizeScore || 0, left: assessment.leftLeg.ulcerSizeScore || 0, fullMark: 3 },
    { subject: 'Compliance', right: assessment.rightLeg.compressionCompliance || 0, left: assessment.leftLeg.compressionCompliance || 0, fullMark: 3 }
  ];

  // Calculate global rvcss manually in case it isn't calculated in Assessment
  const globalRvcssTotal = assessment.rightLeg.rvcssTotal + assessment.leftLeg.rvcssTotal;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Assessment Report</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
          <Button onClick={handleDownload} disabled={isGeneratingPdf} className="bg-[#1a6b5c] hover:bg-[#134d42]">
            <Download className="mr-2 h-4 w-4" /> {isGeneratingPdf ? "Generating..." : "Download PDF"}
          </Button>
        </div>
      </div>

      <div ref={reportRef} className="bg-white shadow-sm border rounded-lg print:shadow-none print:border-0 flex flex-col">
        {/* PAGE 1 */}
        <div className="pdf-page px-8 py-10" style={{ minHeight: '297mm', pageBreakAfter: 'always' }}>
          {/* Header */}
        <div className="border-b-2 border-[#1a6b5c] pb-6 mb-8">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <img src={`${import.meta.env.BASE_URL}kle-logo.png`} alt="KLE Logo" style={{ height: '80px', width: 'auto', maxWidth: '300px', objectFit: 'contain' }} />
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wider"></p>
            </div>
            <div className="text-right text-sm text-slate-600 space-y-1">
              <p><strong>Doctor:</strong> {assessment.assessedBy}</p>
              <p><strong>Date:</strong> {formatDate(assessment.assessmentDate)}</p>
            </div>
          </div>
        </div>

        {/* Patient Info */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8 bg-slate-50 p-4 rounded-lg border">
          <div>
            <p className="text-xs text-muted-foreground uppercase">Patient Name</p>
            <p className="font-semibold text-slate-900">{patient.patientName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">UHID</p>
            <p className="font-semibold text-slate-900">{patient.uhid}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">Age / Gender</p>
            <p className="font-semibold text-slate-900">{patient.age} / {patient.gender}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">Comorbidities</p>
            <p className="font-semibold text-slate-900">{assessment.comorbidities?.length ? assessment.comorbidities.join(", ") : "None"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">Venous History</p>
            <p className="font-semibold text-slate-900">{assessment.venousHistory?.length ? assessment.venousHistory.join(", ") : "None"}</p>
          </div>
        </div>

        {/* Clinical Notes (Addition 1) */}
        <div className="mb-8 p-4 bg-[#fffbeb] border-l-4 border-l-[#f59e0b] rounded-r-lg">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#f59e0b] mb-2">Clinical Notes</h3>
          {assessment.clinicalNotes ? (
            <p className="text-sm text-slate-800 whitespace-pre-wrap">{assessment.clinicalNotes}</p>
          ) : (
            <p className="text-sm text-slate-400 italic">No clinical notes recorded.</p>
          )}
        </div>

        {/* Per-Leg Clinical Findings */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <LegReport leg={assessment.rightLeg} label="Right" />
          <LegReport leg={assessment.leftLeg} label="Left" />
        </div>
        </div>

        {/* PAGE 2 */}
        <div className="pdf-page px-8 py-10 flex flex-col justify-between" style={{ minHeight: '297mm' }}>
          <div>
            {/* rVCSS Visual Graphs (Addition 2) */}
            <div className="mt-4">
              <h3 className="text-xl font-bold text-[#1a6b5c] mb-6 text-center">rVCSS Visualization</h3>

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Right Leg Radar */}
            <div className="bg-slate-50 p-6 rounded-lg border flex flex-col items-center">
              <h4 className="text-md font-bold text-slate-800 mb-2">Right Leg</h4>
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={rvcssData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 3]} tick={{ fontSize: 10 }} />
                    <Radar name="Right Leg" dataKey="right" stroke="#1a6b5c" fill="#1a6b5c" fillOpacity={0.5} />
                    <RechartsTooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 bg-[#1a6b5c]/10 px-6 py-2 rounded-full border border-[#1a6b5c]/30">
                <span className="font-bold text-[#1a6b5c] text-lg">Right Leg: {assessment.rightLeg.rvcssTotal} / 30</span>
              </div>
            </div>

            {/* Left Leg Radar */}
            <div className="bg-slate-50 p-6 rounded-lg border flex flex-col items-center">
              <h4 className="text-md font-bold text-slate-800 mb-2">Left Leg</h4>
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={rvcssData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 3]} tick={{ fontSize: 10 }} />
                    <Radar name="Left Leg" dataKey="left" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.5} />
                    <RechartsTooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 bg-[#f59e0b]/10 px-6 py-2 rounded-full border border-[#f59e0b]/30">
                <span className="font-bold text-[#f59e0b] text-lg">Left Leg: {assessment.leftLeg.rvcssTotal} / 30</span>
              </div>
            </div>
          </div>

          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-slate-800">Total Global rVCSS: <span className="text-[#1a6b5c]">{globalRvcssTotal} / 60</span></h3>
          </div>

          {/* Previous vs Current Visit Comparison */}
          <div className="bg-slate-50 p-6 rounded-lg border">
            <h4 className="text-lg font-bold text-slate-800 mb-1 text-center">rVCSS: Previous vs Current Visit</h4>
            {previousAssessment ? (
              <>
                <p className="text-xs text-center text-slate-500 mb-4">
                  Comparing visit on{" "}
                  <span className="font-semibold text-slate-700">{previousAssessment.assessmentDate}</span>
                  {" "}→{" "}
                  <span className="font-semibold text-[#1a6b5c]">{assessment.assessmentDate}</span>
                  {" (combined both legs)"}
                </p>
                {visitComparisonData && visitComparisonData.length > 0 ? (
                  <>
                    <div className="w-full" style={{ height: Math.max(200, visitComparisonData.length * 52) }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={visitComparisonData}
                          layout="vertical"
                          margin={{ top: 5, right: 40, left: 10, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" domain={[0, 6]} tickCount={7} tick={{ fontSize: 11 }} />
                          <YAxis dataKey="param" type="category" tick={{ fill: '#475569', fontSize: 11 }} width={110} />
                          <RechartsTooltip
                            formatter={(value, name) => [
                              value,
                              name === 'prev' ? 'Previous Visit' : 'Current Visit'
                            ]}
                          />
                          <Legend
                            formatter={(value) => value === 'prev' ? 'Previous Visit' : 'Current Visit'}
                          />
                          <Bar dataKey="prev" name="prev" fill="#94a3b8" radius={[0, 4, 4, 0]} />
                          <Bar dataKey="curr" name="curr" fill="#1a6b5c" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Comprehensive Changes Table */}
                    <div className="mt-8 overflow-x-auto">
                      <h5 className="text-md font-bold text-slate-800 mb-4 border-b pb-2">Comprehensive Changes</h5>
                      {allChangesData && allChangesData.length > 0 ? (
                        <table className="w-full text-sm border">
                          <thead>
                            <tr className="bg-slate-100 border-b-2 border-slate-200">
                              <th className="text-left py-2 px-3 text-slate-600 font-semibold">Category</th>
                              <th className="text-left py-2 px-3 text-slate-600 font-semibold">Parameter</th>
                              <th className="text-left py-2 px-3 text-slate-500">Previous</th>
                              <th className="text-left py-2 px-3 text-[#1a6b5c]">Current</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allChangesData.map((row, idx) => (
                              <tr key={`${row.category}-${row.param}-${idx}`} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="py-2 px-3 font-medium text-slate-500 bg-slate-50/50">{row.category}</td>
                                <td className="py-2 px-3 font-semibold text-slate-700">{row.param}</td>
                                <td className="py-2 px-3 text-slate-500 break-words max-w-[200px]">{row.prev}</td>
                                <td className="py-2 px-3 font-bold text-[#1a6b5c] break-words max-w-[200px]">{row.curr}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="text-center py-6 text-slate-400 text-sm border rounded-lg bg-slate-50">
                          No clinical parameters changed between visits.
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    No data to compare.
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <p className="text-sm font-medium">No previous visit data available</p>
                <p className="text-xs mt-1">This is the patient's first recorded visit.</p>
              </div>
            )}
          </div>
          </div>
        </div>

        {/* PAGE 3 — Doppler Coverage Diagram */}
        <div className="pdf-page px-8 py-10" style={{ minHeight: '297mm', pageBreakBefore: 'always' }}>
          <VenousDiagram images={(assessment as any).dopplerImages || []} />
        </div>

        <div className="text-center mt-12 pt-8 border-t text-sm text-muted-foreground w-full">
          <p>Jawaharlal Nehru Medical College</p>
        </div>
      </div>
    </div>
  </div>
  );
}
