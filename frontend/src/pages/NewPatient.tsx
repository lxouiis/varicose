import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore, type Gender } from "@/store/useStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, UserPlus } from "lucide-react";

export function NewPatient() {
  const navigate = useNavigate();
  const addPatient = useStore((state) => state.addPatient);
  const patients = useStore((state) => state.patients);

  const [name, setName] = useState("");
  const [uhid, setUhid] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Gender>("Male");
  
  const [errors, setErrors] = useState<{ name?: string; uhid?: string }>({});

  const validate = () => {
    const newErrors: { name?: string; uhid?: string } = {};
    
    if (!name.trim()) {
      newErrors.name = "Patient Name is required";
    }
    
    if (!uhid.trim()) {
      newErrors.uhid = "UHID is required";
    } else if (patients.some(p => p.uhid.toLowerCase() === uhid.trim().toLowerCase())) {
      newErrors.uhid = "This UHID is already registered";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;

    const patientId = await addPatient({
      patientName: name.trim(),
      uhid: uhid.trim(),
      age: parseInt(age) || 0,
      gender,
      createdAt: new Date().toISOString()
    });

    if (patientId) {
      navigate(`/assessment/new/${patientId}`);
    } else {
      setErrors({ uhid: "Failed to register patient. UHID might already exist." });
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Register New Patient</h1>
          <p className="text-muted-foreground">Enter patient details to start a new assessment.</p>
        </div>
      </div>

      <Card className="border-t-4 border-t-primary shadow-sm">
        <CardHeader>
          <CardTitle>Demographics</CardTitle>
          <CardDescription>Basic patient identifiers required for the CEVI record.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="patientName">Patient Name <span className="text-destructive">*</span></Label>
                <Input 
                  id="patientName"
                  value={name} 
                  onChange={e => { setName(e.target.value); if (errors.name) setErrors({...errors, name: undefined}); }} 
                  placeholder="e.g. John Doe" 
                  className={errors.name ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errors.name && <p className="text-sm text-destructive font-medium">{errors.name}</p>}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="uhid">UHID <span className="text-destructive">*</span></Label>
                <Input 
                  id="uhid"
                  value={uhid} 
                  onChange={e => { setUhid(e.target.value); if (errors.uhid) setErrors({...errors, uhid: undefined}); }} 
                  placeholder="e.g. UHID-123456" 
                  className={errors.uhid ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errors.uhid && <p className="text-sm text-destructive font-medium">{errors.uhid}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="age">Age</Label>
                  <Input 
                    id="age"
                    type="number" 
                    min="0"
                    max="120"
                    value={age} 
                    onChange={e => setAge(e.target.value)} 
                    placeholder="e.g. 45" 
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <select 
                    id="gender"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={gender} 
                    onChange={e => setGender(e.target.value as Gender)}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t flex flex-col-reverse sm:flex-row justify-end gap-3 mt-8">
              <Button type="button" variant="outline" onClick={() => navigate("/")}>
                Cancel
              </Button>
              <Button type="submit" className="w-full sm:w-auto">
                <UserPlus className="mr-2 h-4 w-4" />
                Register & Start Assessment
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
