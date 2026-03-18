import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function CampaignForm() {
  const { brandId, campaignId } = useParams<{ brandId: string; campaignId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = !!campaignId;

  const [loading, setLoading] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [name, setName] = useState("");
  const [campaignBrief, setCampaignBrief] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [mandatoryElements, setMandatoryElements] = useState("");
  const [negativePrompts, setNegativePrompts] = useState("");

  useEffect(() => {
    if (!brandId) return;
    supabase.from("brands").select("name").eq("id", brandId).single().then(({ data }) => {
      if (data) setBrandName(data.name);
    });

    if (isEditing && campaignId) {
      supabase.from("campaigns").select("*").eq("id", campaignId).single().then(({ data }) => {
        if (data) {
          setName(data.name);
          setCampaignBrief(data.campaign_brief || "");
          setTargetAudience(data.target_audience || "");
          setMandatoryElements(data.mandatory_elements || "");
          setNegativePrompts(data.negative_prompts || "");
        }
      });
    }
  }, [brandId, campaignId, isEditing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user || !brandId) {
      toast.error("Campaign name is required.");
      return;
    }

    setLoading(true);
    const payload = {
      brand_id: brandId,
      user_id: user.id,
      name,
      campaign_brief: campaignBrief,
      target_audience: targetAudience,
      mandatory_elements: mandatoryElements,
      negative_prompts: negativePrompts,
    };

    let error;
    if (isEditing) {
      ({ error } = await supabase.from("campaigns").update(payload).eq("id", campaignId));
    } else {
      ({ error } = await supabase.from("campaigns").insert(payload));
    }

    setLoading(false);
    if (error) {
      toast.error("Failed to save campaign.");
    } else {
      toast.success(`"${name}" ${isEditing ? "updated" : "created"}.`);
      queryClient.invalidateQueries({ queryKey: ["campaigns", brandId] });
      navigate(`/brands/${brandId}/edit`);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <Button variant="ghost" onClick={() => navigate(`/brands/${brandId}/edit`)} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Back to {brandName || "Brand"}
      </Button>

      <h1 className="text-2xl font-display font-bold">
        {isEditing ? "Edit Campaign" : "New Campaign"}
      </h1>
      {brandName && <p className="text-muted-foreground text-sm">For brand: {brandName}</p>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Campaign Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cname">Campaign Name</Label>
              <Input id="cname" value={name} onChange={e => setName(e.target.value)} placeholder='e.g., "Admissions Open 2025"' />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cbrief">Campaign Brief</Label>
              <Textarea id="cbrief" value={campaignBrief} onChange={e => setCampaignBrief(e.target.value)} placeholder="Campaign-specific instructions, themes, and messaging…" rows={5} />
              <p className="text-xs text-muted-foreground">These rules layer on top of brand-level guidelines.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="caudience">Target Audience Override</Label>
              <Textarea id="caudience" value={targetAudience} onChange={e => setTargetAudience(e.target.value)} placeholder="If different from brand-level audience" rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cmandatory">Mandatory Elements</Label>
              <Textarea id="cmandatory" value={mandatoryElements} onChange={e => setMandatoryElements(e.target.value)} placeholder="Required copy, CTAs, offers for this campaign" rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cneg">Campaign Exclusions (Never List)</Label>
              <Textarea id="cneg" value={negativePrompts} onChange={e => setNegativePrompts(e.target.value)} placeholder="Things to exclude specifically for this campaign" rows={3} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={loading} className="gradient-primary hover:gradient-primary-hover text-primary-foreground px-8">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {isEditing ? "Save Changes" : "Create Campaign"}
          </Button>
        </div>
      </form>
    </div>
  );
}
