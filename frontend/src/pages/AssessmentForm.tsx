

import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStore, type LegExam } from "@/store/useStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ChipToggle } from "@/components/ui/chip-toggle";
import { ScoreInput } from "@/components/ui/score-input";
import { CeapBadge } from "@/components/ui/ceap-badge";
import { DopplerUpload, type DopplerSlotImage } from "@/components/ui/doppler-upload";
import { LegImageUpload, type LegPhoto } from "@/components/ui/leg-image-upload";
import api from "@/lib/api";
import { PdfUpload, type PdfFile } from "@/components/ui/pdf-upload";
import { ArrowLeft, Save } from "lucide-react";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from "recharts";

// ── helpers ──────────────────────────────────────────────
const CLINICAL_SIGNS = ["Telangiectasia", "Varicose Veins", "Venous Edema", "Pigmentation", "Lipodermatosclerosis", "Healed Ulcer", "Active Ulcer"] as const;

function liveCClass(signs: string[]): { label: string; color: string } {
  const rank: [string, string, string][] = [
    ["Active Ulcer",        "C6", "bg-red-600 text-white"],
    ["Healed Ulcer",        "C5", "bg-orange-500 text-white"],
    ["Lipodermatosclerosis","C4b","bg-orange-500 text-white"],
    ["Pigmentation",        "C4a","bg-orange-500 text-white"],
    ["Venous Edema",        "C3", "bg-amber-400 text-amber-950"],
    ["Varicose Veins",      "C2", "bg-emerald-500 text-white"],
    ["Telangiectasia",      "C1", "bg-emerald-500 text-white"],
  ];
  for (const [sign, label, color] of rank) {
    if (signs.includes(sign)) return { label, color };
  }
  return { label: "C0", color: "bg-gray-400 text-white" };
}

const SELECT_CLS = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

const initialLegState: LegExam = {
  skin: "Normal", swelling: 0, ulcerPresent: false, tenderness: false, varicosities: [],
  deepSystem: "Patent", sfjReflux: false, gsvDiamMm: 0, incompetentPerforators: false,
  clinicalSigns: [],
  pain: 0, varicoseVeins: 0, venousEdema: 0, skinPigmentation: 0, inflammation: 0,
  induration: 0, ulcerNumber: 0, ulcerDuration: 0, ulcerSizeScore: 0, compressionCompliance: 0,
  ceapTotal: "C0, Ep, An, Pn", rvcssTotal: 0,
};

// ── component ────────────────────────────────────────────
export function AssessmentForm() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const getPatientById = useStore(s => s.getPatientById);
  const addAssessment   = useStore(s => s.addAssessment);
  const addPatient      = useStore(s => s.addPatient);
  const updatePatient   = useStore(s => s.updatePatient);
  const isUhidTaken     = useStore(s => s.isUhidTaken);
  const fetchAssessments = useStore(s => s.fetchAssessments);
  const existingPatient = patientId && patientId !== "new" ? getPatientById(patientId) : null;
  const latestAssessment = existingPatient 
    ? useStore.getState().getAssessmentsByPatientId(existingPatient.id).sort((a,b) => new Date(b.assessmentDate).getTime() - new Date(a.assessmentDate).getTime())[0]
    : null;

  // ── Form error state ────────────────
  const [uhidError, setUhidError] = useState("");
  const [dataLoaded, setDataLoaded] = useState(false);

  // ── Patient basics ─────────────────
  const [patientName, setPatientName] = useState(existingPatient?.patientName || "");
  const [uhid, setUhid]               = useState(existingPatient?.uhid || "");
  const [age, setAge]                 = useState(existingPatient?.age?.toString() || "");
  const [gender, setGender]           = useState<"Male"|"Female"|"Other">(existingPatient?.gender || "Male");

  // ── New demographics fields ────────
  const [height, setHeight]           = useState(existingPatient?.height?.toString() || "");
  const [weight, setWeight]           = useState(existingPatient?.weight?.toString() || "");
  const [ethnicity, setEthnicity]     = useState(existingPatient?.ethnicity || "South Asian");
  const [smoking, setSmoking]         = useState<string[]>(existingPatient?.smokingStatus || []);
  const [occupation, setOccupation]   = useState<string[]>(existingPatient?.occupationType || []);
  const [parity, setParity]           = useState(existingPatient?.parity?.toString() || "");

  const bmi = useMemo(() => {
    const h = parseFloat(height);
    const w = parseFloat(weight);
    if (!h || !w || h <= 0) return "";
    return (w / ((h / 100) ** 2)).toFixed(1);
  }, [height, weight]);

  // ── Section 1: History ─────────────
  // v2: per-visit fields come from Assessment, not Patient
  const [comorbidities, setComorbidities] = useState<string[]>(latestAssessment?.comorbidities || []);
  const [venousHistory, setVenousHistory] = useState<string[]>(latestAssessment?.venousHistory || []);
  const [medications, setMedications]     = useState<string[]>(latestAssessment?.medications   || []);
  const [clinicalNotes, setClinicalNotes] = useState(latestAssessment?.clinicalNotes || "");

  const [bp, setBp]                       = useState("");
  const [pulse, setPulse]                 = useState("");
  const [generalSigns, setGeneralSigns]   = useState<string[]>([]);

  // ── Section 2.5: PROMs ─────────────
  const [rightPainVas, setRightPainVas] = useState(0);
  const [leftPainVas, setLeftPainVas]   = useState(0);
  const [veinesNotes, setVeinesNotes]   = useState("");

  // ── Legs ───────────────────────────
  const [rightLeg, setRightLeg] = useState<LegExam>(latestAssessment ? { ...latestAssessment.rightLeg } : { ...initialLegState });
  const [leftLeg, setLeftLeg]   = useState<LegExam>(latestAssessment ? { ...latestAssessment.leftLeg } : { ...initialLegState });

  // ── New Doppler per-leg fields (expanded, Change 3) ───
  const [rightCommonFemoral, setRightCommonFemoral]         = useState(latestAssessment?.rightLeg.commonFemoralVein || "Normal");
  const [rightSuperficialFemoral, setRightSuperficialFemoral] = useState(latestAssessment?.rightLeg.superficialFemoralVein || "Normal");
  const [rightPoplitealStatus, setRightPoplitealStatus]     = useState(latestAssessment?.rightLeg.poplitealVeinStatus || "Normal");
  const [rightEtiology, setRightEtiology]                   = useState(latestAssessment?.rightLeg.etiology || "");
  const [leftCommonFemoral, setLeftCommonFemoral]           = useState(latestAssessment?.leftLeg.commonFemoralVein || "Normal");
  const [leftSuperficialFemoral, setLeftSuperficialFemoral] = useState(latestAssessment?.leftLeg.superficialFemoralVein || "Normal");
  const [leftPoplitealStatus, setLeftPoplitealStatus]       = useState(latestAssessment?.leftLeg.poplitealVeinStatus || "Normal");
  const [leftEtiology, setLeftEtiology]                     = useState(latestAssessment?.leftLeg.etiology || "");

  // ── File Upload States ─────────────
  const [rightLegPhotos, setRightLegPhotos] = useState<LegPhoto[]>([]);
  const [leftLegPhotos, setLeftLegPhotos] = useState<LegPhoto[]>([]);
  const [dopplerPdfs, setDopplerPdfs] = useState<PdfFile[]>([]);
  const [dopplerImages, setDopplerImages] = useState<DopplerSlotImage[]>(
    latestAssessment?.dopplerImages ? (latestAssessment.dopplerImages as unknown as DopplerSlotImage[]) : []
  );

  // ── Fetch previous assessments on mount for existing patients ──
  useEffect(() => {
    if (!existingPatient || dataLoaded) return;
    
    fetchAssessments(existingPatient.id).then(async () => {
      const assessments = useStore.getState().getAssessmentsByPatientId(existingPatient.id);
      const latest = assessments.sort((a, b) => 
        new Date(b.assessmentDate).getTime() - new Date(a.assessmentDate).getTime()
      )[0];
      
      if (latest) {
        // Pre-populate demographics from patient
        if (existingPatient.height) setHeight(existingPatient.height.toString());
        if (existingPatient.weight) setWeight(existingPatient.weight.toString());
        if (existingPatient.ethnicity) setEthnicity(existingPatient.ethnicity);
        if (existingPatient.smokingStatus?.length) setSmoking(existingPatient.smokingStatus);
        if (existingPatient.occupationType?.length) setOccupation(existingPatient.occupationType);
        if (existingPatient.parity) setParity(existingPatient.parity.toString());

        // Pre-populate from latest assessment (per-visit fields live here in v2)
        if (latest.comorbidities?.length) setComorbidities(latest.comorbidities);
        if (latest.venousHistory?.length) setVenousHistory(latest.venousHistory);
        if (latest.medications?.length)   setMedications(latest.medications);
        if (latest.clinicalNotes)         setClinicalNotes(latest.clinicalNotes);
        if (latest.rightPainVas)          setRightPainVas(latest.rightPainVas);
        if (latest.leftPainVas)           setLeftPainVas(latest.leftPainVas);
        if (latest.veinesNotes)           setVeinesNotes(latest.veinesNotes);

        // Pre-populate leg data (doppler, rVCSS, clinical signs)
        if (latest.rightLeg) {
          setRightLeg({ ...latest.rightLeg });
          setRightCommonFemoral(latest.rightLeg.commonFemoralVein || "Normal");
          setRightSuperficialFemoral(latest.rightLeg.superficialFemoralVein || "Normal");
          setRightPoplitealStatus(latest.rightLeg.poplitealVeinStatus || "Normal");
          setRightEtiology(latest.rightLeg.etiology || "");
        }
        if (latest.leftLeg) {
          setLeftLeg({ ...latest.leftLeg });
          setLeftCommonFemoral(latest.leftLeg.commonFemoralVein || "Normal");
          setLeftSuperficialFemoral(latest.leftLeg.superficialFemoralVein || "Normal");
          setLeftPoplitealStatus(latest.leftLeg.poplitealVeinStatus || "Normal");
          setLeftEtiology(latest.leftLeg.etiology || "");
        }
        
        // ── Fetch persisted Doppler images from DB for this visit ──
        try {
          const { default: api } = await import("@/lib/api");
          const res = await api.get(`/doppler-images/visit/${latest.id}`);
          const savedImages: DopplerSlotImage[] = res.data || [];
          if (savedImages.length > 0) {
            setDopplerImages(savedImages);
          } else if (latest.dopplerImages && latest.dopplerImages.length > 0) {
            // Fall back to store-cached images if API returns none
            setDopplerImages(latest.dopplerImages as any);
          }
        } catch (imgErr) {
          console.warn('[CEVI] Could not fetch saved doppler images:', imgErr);
          // Fall back to store-cached images
          if (latest.dopplerImages && latest.dopplerImages.length > 0) {
            setDopplerImages(latest.dopplerImages as any);
          }
        }
      }
      setDataLoaded(true);
    });
  }, [existingPatient, dataLoaded, fetchAssessments]);

  // ── Prevent accidental navigation/closing ──
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // If we have some data, warn before closing tab
      if (patientName || uhid) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [patientName, uhid]);

  // ── Computed CEAP & rVCSS ──────────
  const computeCEAP = (leg: LegExam, history: string[], etiology: string) => {
    let C = 'C0';
    if (leg.clinicalSigns.includes('Telangiectasia'))      C = 'C1';
    if (leg.clinicalSigns.includes('Varicose Veins'))      C = 'C2';
    if (leg.clinicalSigns.includes('Venous Edema'))        C = 'C3';
    if (leg.clinicalSigns.includes('Pigmentation'))        C = 'C4a';
    if (leg.clinicalSigns.includes('Lipodermatosclerosis'))C = 'C4b';
    if (leg.clinicalSigns.includes('Healed Ulcer'))        C = 'C5';
    if (leg.clinicalSigns.includes('Active Ulcer'))        C = 'C6';
    // Use explicit etiology chip if set, else derive from history
    let E = etiology || (history.includes('Previous DVT') || history.includes('Leg Trauma') ? 'Es' : 'Ep');
    const A_parts: string[] = [];
    if (leg.gsvDiamMm > 0) A_parts.push('As');
    if (leg.deepSystem !== 'Patent') A_parts.push('Ad');
    if (leg.incompetentPerforators) A_parts.push('Ap');
    const A = A_parts.length ? A_parts.join(',') : 'An';
    let P = leg.sfjReflux ? 'Pr' : 'Pn';
    if (leg.deepSystem === 'DVT') P = 'Pr,o';
    return `${C}, E${E}, ${A}, ${P}`;
  };
  const computeRvcss = (leg: LegExam) =>
    leg.pain + leg.varicoseVeins + leg.venousEdema + leg.skinPigmentation +
    leg.inflammation + leg.induration + leg.ulcerNumber + leg.ulcerDuration +
    leg.ulcerSizeScore + leg.compressionCompliance;

  const computedRightCeap  = computeCEAP(rightLeg, venousHistory, rightEtiology);
  const computedRightRvcss = computeRvcss(rightLeg);
  const computedLeftCeap   = computeCEAP(leftLeg, venousHistory, leftEtiology);
  const computedLeftRvcss  = computeRvcss(leftLeg);

  // ── Array helpers ──────────────────
  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
    setter(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  };
  const toggleLeg = (isRight: boolean, field: keyof LegExam, item: string) => {
    const setter = isRight ? setRightLeg : setLeftLeg;
    setter(prev => {
      const arr = prev[field] as string[];
      return { ...prev, [field]: arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item] };
    });
  };
  const updateLeg = (isRight: boolean, field: keyof LegExam, value: number | string | boolean) => {
    (isRight ? setRightLeg : setLeftLeg)(prev => ({ ...prev, [field]: value }));
  };

  const [isSaving, setIsSaving] = useState(false);

  // ── Save ───────────────────────────
  const handleSave = async () => {
    if (rightLeg.clinicalSigns.length === 0 && leftLeg.clinicalSigns.length === 0) {
      if (!window.confirm("You have not selected any Clinical Signs for either leg. This will result in a C0 (No disease) classification. Do you want to proceed?")) {
        return;
      }
    }

    setIsSaving(true);
    let finalPatientId: string | null | undefined = patientId;
    if (!existingPatient || patientId === "new") {
      // Guard: check duplicate UHID before creating patient
      if (uhid.trim() && isUhidTaken(uhid.trim())) {
        setUhidError("A patient with this UHID already exists");
        return;
      }
      try {
        // v2: addPatient only receives STATIC DEMOGRAPHIC fields.
        // Per-visit fields (comorbidities, medications, venousHistory, clinicalNotes,
        // veinesNotes, bp, pulse, painVas) go to addAssessment() below.
        const newId = await addPatient({
          patientName: patientName.trim(),
          uhid: uhid.trim(),
          age: parseInt(age) || 0,
          gender,
          height: parseFloat(height) || undefined,
          weight: parseFloat(weight) || undefined,
          bmi: bmi || undefined,
          ethnicity,
          smokingStatus: smoking,
          occupationType: occupation,
          parity: parity ? parseInt(parity) : undefined,
        });

        if (!newId) throw new Error("Failed to register patient (no ID returned).");
        finalPatientId = newId;

      } catch (err: any) {
        setUhidError(err.message || "Failed to register patient.");
        return;
      }
    } else {
      // Patient already exists — update DEMOGRAPHICS ONLY.
      // Per-visit fields go to the assessment below.
      try {
        await updatePatient(existingPatient.id, {
          patientName: patientName.trim(),
          age: parseInt(age) || existingPatient.age,
          gender,
          height: parseFloat(height) || undefined,
          weight: parseFloat(weight) || undefined,
          bmi: bmi || undefined,
          ethnicity,
          smokingStatus: smoking,
          occupationType: occupation,
          parity: parity ? parseInt(parity) : undefined,
        });
      } catch (err: any) {
        console.error('Failed to update patient demographics:', err);
      }
    }

    try {
      const assessmentResponse = await addAssessment({
        patientId: finalPatientId!,
        // Per-visit history (v2: now on Assessment, not Patient)
        comorbidities,
        venousHistory,
        medications,
        clinicalNotes,
        veinesNotes,
        // General exam — NOW properly sent (fixing silent data loss)
        bp,
        pulse: pulse ? parseInt(pulse) : undefined,
        generalSigns,
        // Legs
        rightLeg: {
          ...rightLeg,
          commonFemoralVein: rightCommonFemoral,
          superficialFemoralVein: rightSuperficialFemoral,
          poplitealVeinStatus: rightPoplitealStatus,
          etiology: rightEtiology,
        },
        leftLeg: {
          ...leftLeg,
          commonFemoralVein: leftCommonFemoral,
          superficialFemoralVein: leftSuperficialFemoral,
          poplitealVeinStatus: leftPoplitealStatus,
          etiology: leftEtiology,
        },
        rightPainVas,
        leftPainVas,
        // Pass doppler clinical metadata (without File blobs — not serializable)
        dopplerImages: dopplerImages.map(({ file, ...rest }) => rest),
      });

      if (assessmentResponse && assessmentResponse.id) {
        // Upload images if any
        const legs = assessmentResponse.legs || [];
        const dbRightLeg = legs.find((l: any) => l.leg_side === 'right');
        const dbLeftLeg = legs.find((l: any) => l.leg_side === 'left');

        console.log('[CEVI] Assessment created:', assessmentResponse.id);
        console.log('[CEVI] Legs returned:', legs.map((l: any) => ({ id: l.id, side: l.leg_side })));

        const uploadPromises: Promise<unknown>[] = [];
        const failedSaves: string[] = [];

        // Right leg clinical photos
        if (dbRightLeg && rightLegPhotos.length > 0) {
          console.log('[CEVI] Uploading', rightLegPhotos.length, 'right leg photos');
          rightLegPhotos.forEach((photo) => {
            if (photo && photo.file) {
              const formData = new FormData();
              formData.append('leg_id', String(dbRightLeg.id));
              formData.append('view_type', photo.view_type);
              formData.append('image', photo.file);
              formData.append('phase', 'clinical');
              formData.append('segment', 'leg');
              formData.append('leg_side', 'right');
              formData.append('view_label', photo.view_type);
              uploadPromises.push(
                api.post('/images', formData)
                  .catch(e => { 
                    console.error('[CEVI] Right image upload failed:', e); 
                    failedSaves.push(`Right Leg Photo (${photo.view_type})`);
                  })
              );
            }
          });
        }

        // Left leg clinical photos
        if (dbLeftLeg && leftLegPhotos.length > 0) {
          console.log('[CEVI] Uploading', leftLegPhotos.length, 'left leg photos');
          leftLegPhotos.forEach((photo) => {
            if (photo && photo.file) {
              const formData = new FormData();
              formData.append('leg_id', String(dbLeftLeg.id));
              formData.append('view_type', photo.view_type);
              formData.append('image', photo.file);
              formData.append('phase', 'clinical');
              formData.append('segment', 'leg');
              formData.append('leg_side', 'left');
              formData.append('view_label', photo.view_type);
              uploadPromises.push(
                api.post('/images', formData)
                  .catch(e => { 
                    console.error('[CEVI] Left image upload failed:', e); 
                    failedSaves.push(`Left Leg Photo (${photo.view_type})`);
                  })
              );
            }
          });
        }

        // Doppler PDFs (legacy)
        if (dopplerPdfs && dopplerPdfs.length > 0 && (dbRightLeg || dbLeftLeg)) {
          const targetLegId = String((dbRightLeg || dbLeftLeg).id);
          console.log('[CEVI] Uploading', dopplerPdfs.length, 'doppler PDFs');
          dopplerPdfs.forEach(pdf => {
            if (pdf.file) {
              const formData = new FormData();
              formData.append('leg_id', targetLegId);
              formData.append('file', pdf.file);
              uploadPromises.push(
                api.post('/doppler', formData)
                  .catch(e => { 
                    console.error('[CEVI] Doppler PDF upload failed:', e); 
                    failedSaves.push('Doppler PDF Document');
                  })
              );
            }
          });
        }

        // Doppler Structured Images
        if (dopplerImages && dopplerImages.length > 0) {
          console.log('[CEVI] Uploading', dopplerImages.length, 'structured doppler images');
          dopplerImages.forEach(img => {
            // We want to upload data even if the image file is missing (data-only findings)
            // But if there's no data AND no file, we skip it
            const hasData = (img.compressible !== undefined && img.compressible !== null) || 
                            (img.spontaneous !== undefined && img.spontaneous !== null) || 
                            (img.refluxMs !== undefined && img.refluxMs !== null) || 
                            (img.refluxPositive !== undefined && img.refluxPositive !== null) ||
                            (img.diameterMm !== undefined && img.diameterMm !== null) || 
                            (img.outwardFlow350 !== undefined && img.outwardFlow350 !== null);
            if (!img.file && !img.filePath && !hasData) return;
            
            const targetLegRow = img.leg === 'left' ? dbLeftLeg : dbRightLeg;
            if (!targetLegRow) return;
            
            const formData = new FormData();
            formData.append('leg_id', String(targetLegRow.id));
            formData.append('leg_side', img.leg);
            formData.append('phase', img.phase);
            formData.append('segment', img.segment);
            formData.append('view_type', img.view);
            if (img.fileName) formData.append('file_name', img.fileName);
            if (img.filePath) formData.append('file_path', img.filePath);
            if (img.file) formData.append('file', img.file);
            
            if (img.compressible !== undefined && img.compressible !== null) formData.append('compressible', String(img.compressible));
            if (img.spontaneous !== undefined && img.spontaneous !== null) formData.append('spontaneous_flow', String(img.spontaneous));
            if (img.refluxMs !== undefined && img.refluxMs !== null) formData.append('reflux_ms', String(img.refluxMs));
            if (img.refluxPositive !== undefined && img.refluxPositive !== null) formData.append('reflux_positive', String(img.refluxPositive));
            if (img.diameterMm !== undefined && img.diameterMm !== null) formData.append('diameter_mm', String(img.diameterMm));
            if (img.outwardFlow350 !== undefined && img.outwardFlow350 !== null) formData.append('outward_flow', String(img.outwardFlow350));

            uploadPromises.push(
              api.post('/doppler-images', formData)
                .catch(e => { 
                  console.error('[CEVI] Doppler img upload failed:', img.fileName, e); 
                  failedSaves.push(`Doppler Image: ${img.fileName}`);
                })
            );
          });
        }

        if (uploadPromises.length > 0) {
          console.log('[CEVI] Waiting for', uploadPromises.length, 'uploads...');
          await Promise.allSettled(uploadPromises);
        }

        // Fetch latest patient record to sync Zustand store
        try {
          await api.get(`/patients/${finalPatientId}`);
          // The store expects mapped data or just triggers fetchPatients/fetchAssessments.
          // Wait, fetchAssessments handles mapping and saving to store.
          await useStore.getState().fetchAssessments(finalPatientId!);
        } catch (syncErr) {
          console.error('[CEVI] Store sync failed after save', syncErr);
        }

        if (failedSaves.length > 0) {
          alert(`Assessment saved, but some files failed to upload:\n\n- ${failedSaves.join('\n- ')}\n\nYou can proceed, but these files might be missing.`);
        }

        navigate(`/assessment/${assessmentResponse.id}/report`);
      } else {
        throw new Error("Failed to create assessment");
      }
    } catch (err: any) {
      setIsSaving(false);
      alert("Failed to save assessment: " + (err.message || "Unknown error"));
    }
  };

  // ── Render ─────────────────────────
  const LiveCBadge = ({ signs }: { signs: string[] }) => {
    const { label, color } = liveCClass(signs);
    return <span className={`${color} font-mono text-xs font-bold px-2.5 py-1 rounded-full`}>{label}</span>;
  };



  return (
    <div className="flex gap-8 max-w-6xl mx-auto">
      {/* Sidebar */}
      <div className="hidden lg:block w-48 shrink-0">
        <div className="sticky top-24 space-y-4">
          <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4">Assessment</h3>
          <ul className="space-y-3 text-sm font-medium text-slate-500">
            {["Demographics","General Exam","PROMs","Local Exam","Doppler","rVCSS Scores"].map((s,i) => (
              <li key={s} className={`flex items-center gap-2 ${i===0?"text-primary":""}`}>
                <div className={`w-2 h-2 rounded-full ${i===0?"bg-primary":"border border-slate-300"}`} /> {s}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex-1 space-y-8 pb-32">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">New Assessment</h1>
            <p className="text-muted-foreground">Complete the eCRF form to calculate CEAP & rVCSS.</p>
          </div>
        </div>

        {/* ═══════ SECTION 1: Demographics ═══════ */}
        <Card className="border-t-4 border-t-[#1a6b5c] shadow-sm">
          <CardHeader><CardTitle>1. Demographics & History</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {/* Row 1: basics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2"><Label>Patient Name</Label><Input value={patientName} onChange={e=>setPatientName(e.target.value)} placeholder="John Doe" /></div>
              <div className="space-y-2">
                <Label>UHID</Label>
                <Input value={uhid} onChange={e=>{setUhid(e.target.value); if(uhidError) setUhidError("");}} placeholder="UHID-1234" className={uhidError ? "border-red-500 focus-visible:ring-red-500" : ""} />
                {uhidError && <p className="text-sm text-red-600 font-medium">{uhidError}</p>}
              </div>
              <div className="space-y-2"><Label>Age</Label><Input type="number" value={age} onChange={e=>setAge(e.target.value)} placeholder="45" /></div>
              <div className="space-y-2"><Label>Gender</Label>
                <select className={SELECT_CLS} value={gender} onChange={e=>setGender(e.target.value as "Male"|"Female"|"Other")}>
                  <option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* Row 2: anthropometrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2"><Label>Height (cm)</Label><Input type="number" value={height} onChange={e=>setHeight(e.target.value)} placeholder="170" /></div>
              <div className="space-y-2"><Label>Weight (kg)</Label><Input type="number" value={weight} onChange={e=>setWeight(e.target.value)} placeholder="70" /></div>
              <div className="space-y-2"><Label>BMI (auto)</Label><Input readOnly value={bmi} placeholder="—" className="bg-slate-50 font-semibold" /></div>
              <div className="space-y-2"><Label>Race / Ethnicity</Label>
                <select className={SELECT_CLS} value={ethnicity} onChange={e=>setEthnicity(e.target.value)}>
                  {["South Asian","Asian","Caucasian","African","Other"].map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
            </div>

            {/* Smoking */}
            <div className="space-y-3">
              <Label>Smoking Status</Label>
              <div className="flex flex-wrap gap-2">
                {["Never","Former","Current"].map(s=>(
                  <ChipToggle key={s} label={s} selected={smoking.includes(s)} onClick={()=>toggle(setSmoking,s)} />
                ))}
              </div>
            </div>

            {/* Occupation */}
            <div className="space-y-3">
              <Label>Occupation Type</Label>
              <div className="flex flex-wrap gap-2">
                {["Prolonged Standing","Prolonged Sitting","Active","Mixed"].map(o=>(
                  <ChipToggle key={o} label={o} selected={occupation.includes(o)} onClick={()=>toggle(setOccupation,o)} />
                ))}
              </div>
            </div>

            {/* Parity (female only) */}
            {gender === "Female" && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Obstetric History — Parity</Label>
                  <Input type="number" min="0" value={parity} onChange={e=>setParity(e.target.value)} placeholder="Number of pregnancies" />
                </div>
              </div>
            )}

            {/* Comorbidities */}
            <div className="space-y-3">
              <Label>Comorbidities</Label>
              <div className="flex flex-wrap gap-2">
                {["Hypertension","Diabetes","CAD","Obesity","Hypothyroidism","Autoimmune Disease","COPD","Bleeding Disorder"].map(item=>(
                  <ChipToggle key={item} label={item} selected={comorbidities.includes(item)} onClick={()=>toggle(setComorbidities,item)} />
                ))}
              </div>
            </div>

            {/* Current Medications */}
            <div className="space-y-3">
              <Label>Current Medications</Label>
              <div className="flex flex-wrap gap-2">
                {["Anticoagulants","Antiplatelet Therapy","Hormonal Therapy","None"].map(item=>(
                  <ChipToggle key={item} label={item} selected={medications.includes(item)} onClick={()=>toggle(setMedications,item)} />
                ))}
              </div>
            </div>

            {/* Venous History */}
            <div className="space-y-3">
              <Label>Venous History</Label>
              <div className="flex flex-wrap gap-2">
                {["None/Primary","Previous DVT","Leg Trauma","Family History","Superficial Thrombophlebitis"].map(item=>(
                  <ChipToggle key={item} label={item} selected={venousHistory.includes(item)} onClick={()=>toggle(setVenousHistory,item)} />
                ))}
              </div>
            </div>

            {/* Clinical Signs per leg (moved to Section 1) */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Clinical Signs</Label>
              <p className="text-xs text-muted-foreground">Select signs present per leg — determines CEAP class</p>
              <div className="grid md:grid-cols-2 gap-6">
                {[{ isRight: true, leg: rightLeg }, { isRight: false, leg: leftLeg }].map(({ isRight, leg }) => (
                  <div key={isRight?"R":"L"} className="space-y-2 p-3 bg-slate-50 rounded-lg border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-slate-700">{isRight ? "Right" : "Left"} Leg</span>
                      <LiveCBadge signs={leg.clinicalSigns} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {CLINICAL_SIGNS.map(sign => (
                        <ChipToggle
                          key={sign}
                          label={sign}
                          activeColor={sign.includes("Ulcer") ? "destructive" : "primary"}
                          selected={leg.clinicalSigns.includes(sign)}
                          onClick={() => toggleLeg(isRight, "clinicalSigns", sign)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Clinical Notes */}
            <div className="space-y-2">
              <Label>Clinical Notes</Label>
              <textarea
                rows={4}
                value={clinicalNotes}
                onChange={e=>setClinicalNotes(e.target.value)}
                placeholder="Doctor's personal observations, additional history, or remarks about this patient..."
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a6b5c]/40 focus-visible:ring-offset-2"
              />
            </div>
          </CardContent>
        </Card>

        {/* ═══════ SECTION 2: General Exam ═══════ */}
        <Card className="border-t-4 border-t-[#1a6b5c] shadow-sm">
          <CardHeader><CardTitle>2. General Physical Examination</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2"><Label>Blood Pressure</Label><Input value={bp} onChange={e=>setBp(e.target.value)} placeholder="120/80 mmHg" /></div>
              <div className="space-y-2"><Label>Pulse Rate (bpm)</Label><Input type="number" value={pulse} onChange={e=>setPulse(e.target.value)} placeholder="72" /></div>
            </div>
            <div className="space-y-3">
              <Label>General Signs</Label>
              <div className="flex flex-wrap gap-2">
                {["Pallor","Icterus","Clubbing","Cyanosis"].map(item=>(
                  <ChipToggle key={item} label={item} selected={generalSigns.includes(item)} onClick={()=>toggle(setGeneralSigns,item)} />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ═══════ SECTION 2.5: PROMs ═══════ */}
        <Card className="border-t-4 border-t-[#1a6b5c] shadow-sm">
          <CardHeader>
            <CardTitle>2.5 Patient Reported Outcomes (PROMs)</CardTitle>
            <p className="text-sm text-muted-foreground">Self-reported pain scores and quality-of-life observations.</p>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Right Leg VAS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Right Leg Pain — VAS</Label>
                <span className="font-mono font-bold text-2xl text-[#1a6b5c]">{rightPainVas}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground whitespace-nowrap">No Pain</span>
                <input type="range" min={0} max={10} step={1} value={rightPainVas} onChange={e=>setRightPainVas(Number(e.target.value))}
                  className="flex-1 h-2 rounded-lg appearance-none bg-slate-200 accent-[#1a6b5c] cursor-pointer" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">Worst Pain</span>
              </div>
            </div>
            {/* Left Leg VAS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Left Leg Pain — VAS</Label>
                <span className="font-mono font-bold text-2xl text-[#1a6b5c]">{leftPainVas}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground whitespace-nowrap">No Pain</span>
                <input type="range" min={0} max={10} step={1} value={leftPainVas} onChange={e=>setLeftPainVas(Number(e.target.value))}
                  className="flex-1 h-2 rounded-lg appearance-none bg-slate-200 accent-[#1a6b5c] cursor-pointer" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">Worst Pain</span>
              </div>
            </div>
            {/* VEINES */}
            <div className="space-y-2">
              <Label>VEINES-QOL/Sym Notes</Label>
              <textarea rows={3} value={veinesNotes} onChange={e=>setVeinesNotes(e.target.value)}
                placeholder="Record patient-reported quality of life observations. Full standardized questionnaire to be integrated in Phase 2."
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
            </div>
          </CardContent>
        </Card>

        {/* ═══════ SECTION 3: Local Exam ═══════ */}
        <Card className="border-t-4 border-t-[#1a6b5c] shadow-sm">
          <CardHeader><CardTitle>3. Local Examination</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-8">
            {[{ isRight: true, leg: rightLeg }, { isRight: false, leg: leftLeg }].map(({ isRight, leg }) => (
              <div key={isRight?"R":"L"} className="space-y-4 p-4 bg-slate-50/50 rounded-lg border">
                <h3 className="font-semibold text-lg text-slate-800 border-b pb-2">{isRight?"Right":"Left"} Leg</h3>
                <div className="space-y-2"><Label>Skin Changes</Label>
                  <select className={SELECT_CLS} value={leg.skin} onChange={e=>updateLeg(isRight,"skin",e.target.value)}>
                    {["Normal","Pigmented","Eczema","Lipodermatosclerosis"].map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
                <ScoreInput label="Swelling Grade (0-3)" value={leg.swelling} onChange={v=>updateLeg(isRight,"swelling",v)} />

                {/* Ulcer Subsection (Change 2) */}
                <div className="border-t pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold">Ulcer Present</Label>
                    <button type="button" onClick={()=>updateLeg(isRight,"ulcerPresent",!leg.ulcerPresent)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${leg.ulcerPresent ? "bg-red-600" : "bg-slate-300"}`}>
                      <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${leg.ulcerPresent ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </div>
                  {leg.ulcerPresent && (
                    <div className="space-y-4 pl-3 border-l-2 border-red-200">
                      <div className="space-y-2">
                        <Label>Ulcer Location</Label>
                        <Input
                          value={leg.ulcerLocationText || ""}
                          onChange={e=>updateLeg(isRight,"ulcerLocationText",e.target.value)}
                          placeholder="e.g. medial malleolus"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Ulcer Size (cm)</Label>
                        <Input
                          type="number" step="0.1" min="0"
                          value={leg.ulcerSizeCm ?? ""}
                          onChange={e=>updateLeg(isRight,"ulcerSizeCm",parseFloat(e.target.value)||0)}
                          placeholder="e.g. 2.5"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Ulcer Type</Label>
                        <div className="flex flex-wrap gap-2">
                          {["Venous","Arterial","Mixed"].map(t=>(
                            <ChipToggle key={t} label={t}
                              selected={leg.ulcerType === t}
                              onClick={()=>updateLeg(isRight,"ulcerType",leg.ulcerType===t?"":t)}
                              activeColor="destructive"
                            />
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Ulcer Edges</Label>
                        <div className="flex flex-wrap gap-2">
                          {["Sloping","Punched out","Undermined"].map(t=>(
                            <ChipToggle key={t} label={t}
                              selected={leg.ulcerEdges === t}
                              onClick={()=>updateLeg(isRight,"ulcerEdges",leg.ulcerEdges===t?"":t)}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Ulcer Base</Label>
                        <div className="flex flex-wrap gap-2">
                          {["Granulating","Sloughy","Necrotic"].map(t=>(
                            <ChipToggle key={t} label={t}
                              selected={leg.ulcerBase === t}
                              onClick={()=>updateLeg(isRight,"ulcerBase",leg.ulcerBase===t?"":t)}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ═══════ SECTION 4: Doppler & Clinical Signs ═══════ */}
        <Card className="border-t-4 border-t-[#1a6b5c] shadow-sm">
          <CardHeader><CardTitle>4. Doppler & Clinical Signs</CardTitle></CardHeader>
          <CardContent className="space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
              {[
                {
                  isRight: true, leg: rightLeg, ceap: computedRightCeap,
                  cf: rightCommonFemoral, setCf: setRightCommonFemoral,
                  sf: rightSuperficialFemoral, setSf: setRightSuperficialFemoral,
                  pv: rightPoplitealStatus, setPv: setRightPoplitealStatus,
                },
                {
                  isRight: false, leg: leftLeg, ceap: computedLeftCeap,
                  cf: leftCommonFemoral, setCf: setLeftCommonFemoral,
                  sf: leftSuperficialFemoral, setSf: setLeftSuperficialFemoral,
                  pv: leftPoplitealStatus, setPv: setLeftPoplitealStatus,
                },
              ].map(({ isRight, leg, ceap, cf, setCf, sf, setSf, pv, setPv }) => (
                <div key={isRight?"R":"L"} className="space-y-6 p-4 bg-slate-50/50 rounded-lg border">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="font-semibold text-lg text-slate-800">{isRight?"Right":"Left"} Leg</h3>
                    <CeapBadge ceap={ceap} />
                  </div>
                  <div className="space-y-4">
                    {/* Deep Venous System subsection */}
                    <div className="space-y-3 p-3 bg-white rounded-md border border-slate-200">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Deep Venous System</p>
                      <div className="space-y-2"><Label>Common Femoral Vein</Label>
                        <select className={SELECT_CLS} value={cf} onChange={e=>setCf(e.target.value)}>
                          {["Normal","Reflux","Obstruction","DVT"].map(o=><option key={o}>{o}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2"><Label>Superficial Femoral Vein</Label>
                        <select className={SELECT_CLS} value={sf} onChange={e=>setSf(e.target.value)}>
                          {["Normal","Reflux","Obstruction","DVT"].map(o=><option key={o}>{o}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2"><Label>Popliteal Vein</Label>
                        <select className={SELECT_CLS} value={pv} onChange={e=>setPv(e.target.value)}>
                          {["Normal","Reflux","Obstruction","DVT"].map(o=><option key={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>
                    {/* GSV + SSV */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2"><Label>GSV Diameter (mm)</Label>
                        <Input type="number" step="0.1" value={leg.gsvDiamMm||""} onChange={e=>updateLeg(isRight,"gsvDiamMm",parseFloat(e.target.value)||0)} />
                      </div>
                      <div className="space-y-2"><Label>SSV Diameter (mm)</Label>
                        <Input type="number" step="0.1" value={leg.ssvDiamMm??""} onChange={e=>updateLeg(isRight,"ssvDiamMm",parseFloat(e.target.value)||0)} />
                      </div>
                    </div>
                    {/* SFJ Reflux toggle */}
                    <div className="flex items-center justify-between">
                      <Label>SFJ Reflux</Label>
                      <button type="button" onClick={()=>updateLeg(isRight,"sfjReflux",!leg.sfjReflux)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${leg.sfjReflux ? "bg-[#1a6b5c]" : "bg-slate-300"}`}>
                        <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${leg.sfjReflux ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ═══════ SECTION 4.5: Etiology Classification ═══════ */}
        <Card className="border-t-4 border-t-[#1a6b5c] shadow-sm">
          <CardHeader>
            <CardTitle>4.5 E — Etiology Classification</CardTitle>
            <p className="text-sm text-muted-foreground">
              Based on clinical history — primary if no identifiable cause, secondary if post-DVT or traumatic, congenital if present since birth.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {[
                { isRight: true, etiology: rightEtiology, setEtiology: setRightEtiology },
                { isRight: false, etiology: leftEtiology, setEtiology: setLeftEtiology },
              ].map(({ isRight, etiology, setEtiology }) => (
                <div key={isRight ? "R" : "L"} className="space-y-3 p-4 bg-slate-50 rounded-lg border">
                  <p className="text-sm font-semibold text-slate-700">{isRight ? "Right" : "Left"} Leg</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { val: "Ep", label: "Ep — Primary" },
                      { val: "Es", label: "Es — Secondary" },
                      { val: "Ec", label: "Ec — Congenital" },
                      { val: "En", label: "En — No cause identified" },
                    ].map(({ val, label }) => (
                      <ChipToggle
                        key={val}
                        label={label}
                        selected={etiology === val}
                        onClick={() => setEtiology(etiology === val ? "" : val)}
                      />
                    ))}
                  </div>
                  {etiology && (
                    <p className="text-xs text-[#1a6b5c] font-semibold">Selected: {etiology}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ═══════ SECTION 5: rVCSS ═══════ */}
        <Card className="border-t-4 border-t-[#1a6b5c] shadow-sm bg-slate-50/30">
          <CardHeader>
            <CardTitle>5. rVCSS Scoring</CardTitle>
            <p className="text-sm text-muted-foreground">Rate severity of each finding — determines rVCSS score. Radar charts update live.</p>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="grid md:grid-cols-2 gap-x-12 gap-y-16">
              {[
                { isRight: true, rvcss: computedRightRvcss, color: "#1a6b5c", label: "Right" },
                { isRight: false, rvcss: computedLeftRvcss, color: "#f59e0b", label: "Left" },
              ].map(({ isRight, rvcss, color, label }) => {
                const leg = isRight ? rightLeg : leftLeg;
                const radarData = [
                  { param: "Pain", value: leg.pain },
                  { param: "Varicose Veins", value: leg.varicoseVeins },
                  { param: "Venous Edema", value: leg.venousEdema },
                  { param: "Skin Pigm.", value: leg.skinPigmentation },
                  { param: "Inflammation", value: leg.inflammation },
                  { param: "Induration", value: leg.induration },
                  { param: "Ulcer #", value: leg.ulcerNumber },
                  { param: "Ulcer Dur.", value: leg.ulcerDuration },
                  { param: "Ulcer Size", value: leg.ulcerSizeScore },
                  { param: "Compression", value: leg.compressionCompliance },
                ];
                return (
                  <div key={isRight?"R":"L"} className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h3 className="font-semibold text-lg text-slate-800">{label} Leg</h3>
                      <span className="font-mono font-bold text-lg px-3 py-1 rounded" style={{ backgroundColor: `${color}15`, color }}>{rvcss} / 30</span>
                    </div>
                    <div className="space-y-3">
                      <ScoreInput label="1. Pain"              value={leg.pain}              onChange={v=>updateLeg(isRight,"pain",v)} />
                      <ScoreInput label="2. Varicose Veins"    value={leg.varicoseVeins}     onChange={v=>updateLeg(isRight,"varicoseVeins",v)} />
                      <ScoreInput label="3. Venous Edema"      value={leg.venousEdema}       onChange={v=>updateLeg(isRight,"venousEdema",v)} />
                      <ScoreInput label="4. Skin Pigmentation" value={leg.skinPigmentation}  onChange={v=>updateLeg(isRight,"skinPigmentation",v)} />
                      <ScoreInput label="5. Inflammation"      value={leg.inflammation}      onChange={v=>updateLeg(isRight,"inflammation",v)} />
                      <ScoreInput label="6. Induration"        value={leg.induration}        onChange={v=>updateLeg(isRight,"induration",v)} />
                      <ScoreInput label="7. Ulcer Number"      value={leg.ulcerNumber}       onChange={v=>updateLeg(isRight,"ulcerNumber",v)} />
                      <ScoreInput label="8. Ulcer Duration"    value={leg.ulcerDuration}     onChange={v=>updateLeg(isRight,"ulcerDuration",v)} />
                      <ScoreInput label="9. Ulcer Size"        value={leg.ulcerSizeScore}    onChange={v=>updateLeg(isRight,"ulcerSizeScore",v)} />
                      <ScoreInput label="10. Compression"      value={leg.compressionCompliance} onChange={v=>updateLeg(isRight,"compressionCompliance",v)} />
                    </div>

                    {/* Radar chart per leg */}
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="text-sm font-semibold text-slate-700 mb-2" style={{ color }}>{label} Leg — rVCSS Profile</h4>
                      <div style={{ width: "100%", maxWidth: 320, margin: "0 auto" }}>
                        <ResponsiveContainer width="100%" height={300}>
                          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                            <PolarGrid stroke="#e2e8f0" />
                            <PolarAngleAxis dataKey="param" tick={{ fontSize: 10, fill: "#64748b" }} />
                            <PolarRadiusAxis angle={90} domain={[0, 3]} tickCount={4} tick={{ fontSize: 9, fill: "#94a3b8" }} />
                            <Radar name={`${label} Leg`} dataKey="value" stroke={color} fill={color} fillOpacity={0.25} strokeWidth={2} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex justify-center mt-2">
                        <span className="font-mono font-bold text-base px-4 py-1.5 rounded-full text-white" style={{ backgroundColor: color }}>
                          {label} Total: {rvcss} / 30
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ═══════ Image Upload ═══════ */}
        <Card className="border-t-4 border-t-[#1a6b5c] shadow-sm bg-slate-50/30">
          <CardHeader>
            <CardTitle>Image Upload — Clinical Photos</CardTitle>
            <p className="text-sm text-muted-foreground">Upload 4 clinical photos per leg (Front, Medial, Lateral, Posterior).</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <LegImageUpload leg="Right" photos={rightLegPhotos} onChange={setRightLegPhotos} />
              <LegImageUpload leg="Left"  photos={leftLegPhotos}  onChange={setLeftLegPhotos} />
            </div>
          </CardContent>
        </Card>

        {/* ═══════ Doppler Structured Upload ═══════ */}
        <Card className="border-t-4 border-t-[#1a6b5c] shadow-sm bg-slate-50/30">
          <CardHeader>
            <CardTitle>Doppler USG — Structured Image Upload</CardTitle>
            <p className="text-sm text-muted-foreground">
              Upload Doppler screenshots organized by examination phase. Enter clinical data per slot. Switch between Right and Left leg tabs.
            </p>
          </CardHeader>
          <CardContent>
            <DopplerUpload images={dopplerImages} onChange={setDopplerImages} />
          </CardContent>
        </Card>

        {/* ═══════ Doppler Report (PDF) ═══════ */}
        <Card className="border-t-4 border-t-[#1a6b5c] shadow-sm bg-slate-50/30">
          <CardHeader>
            <CardTitle>Doppler Report (PDF)</CardTitle>
            <p className="text-sm text-muted-foreground">Upload the printed PDF report from the USG machine.</p>
          </CardHeader>
          <CardContent>
            <PdfUpload title="Doppler Report" files={dopplerPdfs} onChange={setDopplerPdfs} />
          </CardContent>
        </Card>

        {/* ═══════ Sticky footer ═══════ */}
        <div className="flex justify-end gap-4 fixed bottom-0 left-0 right-0 bg-white border-t p-4 z-50">
          <div className="container mx-auto flex justify-end gap-4 px-4 sm:px-8 max-w-6xl">
            <Button variant="outline" size="lg" onClick={()=>navigate("/")}>Cancel</Button>
            <Button size="lg" className="w-full sm:w-auto bg-[#1a6b5c] hover:bg-[#134d42]" onClick={handleSave} disabled={isSaving}>
              <Save className="mr-2 h-5 w-5" /> {isSaving ? "Saving..." : "Calculate CEAP & Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
