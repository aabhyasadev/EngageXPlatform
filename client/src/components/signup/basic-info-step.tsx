import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft } from "lucide-react";

interface BasicInfoStepProps {
  data: {
    first_name: string;
    last_name: string;
    phone: string;
  };
  onNext: () => void;
  onBack: () => void;
  onDataUpdate: (data: { first_name: string; last_name: string; phone: string; email: string }) => void;
}

export default function BasicInfoStep({ data, onNext, onBack, onDataUpdate }: BasicInfoStepProps) {
  const [formData, setFormData] = useState({
    first_name: data.first_name,
    last_name: data.last_name,
    phone: data.phone,
  });
  const [detectedCountry, setDetectedCountry] = useState("");
  const { toast } = useToast();

  const basicInfoMutation = useMutation({
    mutationFn: async (info: any) => {
      const response = await apiRequest("POST", "/api/signup/basic-info", info);
      return response.json();
    },
    onSuccess: () => {
      onDataUpdate({ 
        ...formData, 
        email: "" // This will be populated from session on backend
      });
      toast({
        title: "Information saved",
        description: "Your basic information has been saved.",
      });
      onNext();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save basic information",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.first_name.trim() || !formData.last_name.trim() || !formData.phone.trim()) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    basicInfoMutation.mutate(formData);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const phone = e.target.value;
    setFormData(prev => ({ ...prev, phone }));

    // Simple country code detection
    if (phone.startsWith("+1")) {
      setDetectedCountry("🇺🇸 United States / Canada");
    } else if (phone.startsWith("+44")) {
      setDetectedCountry("🇬🇧 United Kingdom");
    } else if (phone.startsWith("+33")) {
      setDetectedCountry("🇫🇷 France");
    } else if (phone.startsWith("+49")) {
      setDetectedCountry("🇩🇪 Germany");
    } else if (phone.startsWith("+91")) {
      setDetectedCountry("🇮🇳 India");
    } else {
      setDetectedCountry("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            type="text"
            placeholder="Enter your first name"
            value={formData.first_name}
            onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
            disabled={basicInfoMutation.isPending}
            required
            data-testid="input-first-name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            type="text"
            placeholder="Enter your last name"
            value={formData.last_name}
            onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
            disabled={basicInfoMutation.isPending}
            required
            data-testid="input-last-name"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone Number</Label>
        <Input
          id="phone"
          type="tel"
          placeholder="+1 (555) 123-4567"
          value={formData.phone}
          onChange={handlePhoneChange}
          disabled={basicInfoMutation.isPending}
          required
          data-testid="input-phone"
        />
        {detectedCountry && (
          <p className="text-sm text-muted-foreground">
            Detected: {detectedCountry}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Include country code (e.g., +1 for US/Canada)
        </p>
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={basicInfoMutation.isPending}
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Button
          type="submit"
          className="flex-1"
          disabled={basicInfoMutation.isPending}
          data-testid="button-continue"
        >
          {basicInfoMutation.isPending ? "Saving..." : "Continue"}
        </Button>
      </div>
    </form>
  );
}