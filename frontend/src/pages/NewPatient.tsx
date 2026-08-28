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

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Gender>("Male");

  const [errors, setErrors] = useState<{ name?: string; general?: string }>({});

  const validate = () => {
    const newErrors: { name?: string } = {};

    if (!name.trim()) {
      newErrors.name = "Patient Name is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    // UHID is generated automatically by the server — no manual entry, so two
    // doctors registering patients at the same moment can never collide.
    try {
      const patientId = await addPatient({
        patientName: name.trim(),
        age: parseInt(age) || 0,
        gender,
        createdAt: new Date().toISOString()
      });

      if (patientId) {
        navigate(`/assessment/new/${patientId}`);
      } else {
        setErrors({ general: "Failed to register patient. Please try again." });
      }
    } catch (err: any) {
      setErrors({ general: err.message || "Failed to register patient. Please try again." });
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
              
              <p className="text-sm text-muted-foreground -mt-2">
                UHID will be assigned automatically once you register the patient.
              </p>

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

            {errors.general && (
              <p className="text-sm text-destructive font-medium">{errors.general}</p>
            )}

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
