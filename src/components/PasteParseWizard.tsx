import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Wand2, ClipboardPaste, Check, X } from "lucide-react";
import { parseMasterOutput, type ParsedMasterOutput } from "@/lib/brandParser";

interface Props {
  /** Called when the user confirms the parsed result. Caller decides what to merge. */
  onApply: (parsed: ParsedMasterOutput) => void;
}

interface ChangePreview {
  field: string;
  value: string;
}

export default function PasteParseWizard({ onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ParsedMasterOutput | null>(null);

  const changes = useMemo<ChangePreview[]>(() => {
    if (!preview) return [];
    const list: ChangePreview[] = [];
    if (preview.industry) list.push({ field: "Industry", value: preview.industry });
    if (preview.brandName) list.push({ field: "Brand name", value: preview.brandName });
    if (preview.primaryColor) list.push({ field: "Primary color", value: preview.primaryColor });
    if (preview.secondaryColor) list.push({ field: "Secondary color", value: preview.secondaryColor });
    if (preview.extraColors.length) list.push({ field: "Extra colors", value: `${preview.extraColors.length} color(s)` });
    if (preview.assetTags.length) list.push({ field: "Asset tags", value: `${preview.assetTags.length} tag(s)` });
    if (preview.briefIdentity) list.push({ field: "Brief — Identity", value: `${preview.briefIdentity.length} chars` });
    if (preview.briefMandatory) list.push({ field: "Brief — Must-Include", value: `${preview.briefMandatory.length} chars` });
    if (preview.briefVisual) list.push({ field: "Brief — Visual Direction", value: `${preview.briefVisual.length} chars` });
    if (preview.briefCopy) list.push({ field: "Brief — Example Copy", value: `${preview.briefCopy.length} chars` });
    if (preview.voiceRules) list.push({ field: "Tone & Audience", value: `${preview.voiceRules.length} chars` });
    if (preview.visualNevers) list.push({ field: "Visual Nevers", value: `${preview.visualNevers.length} chars` });
    if (preview.contentNevers) list.push({ field: "Content Nevers", value: `${preview.contentNevers.length} chars` });
    return list;
  }, [preview]);

  const handleParse = () => {
    if (!text.trim()) return;
    setPreview(parseMasterOutput(text));
  };

  const handleApply = () => {
    if (!preview) return;
    onApply(preview);
    setText("");
    setPreview(null);
    setOpen(false);
  };

  const handlePasteFromClipboard = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) {
        setText(t);
        setPreview(parseMasterOutput(t));
      }
    } catch {
      // ignore — most browsers prompt for permission
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-secondary/40 bg-gradient-to-br from-secondary/5 via-background to-primary/5">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-secondary/5 transition-colors rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-secondary/15 flex items-center justify-center">
                  <Wand2 className="h-4 w-4 text-secondary-foreground" />
                </div>
                <div>
                  <CardTitle className="text-base font-display flex items-center gap-2">
                    Paste & Parse
                    <Badge variant="secondary" className="text-[10px] h-5">From Claude</Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Drop the whole Master Prompt output here — we'll route every section automatically.
                  </CardDescription>
                </div>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Textarea
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  if (preview) setPreview(null);
                }}
                placeholder={`## INDUSTRY\nReal Estate\n\n## BRAND NAME\n…\n\n## COLOR PALETTE\n- Primary: #1a2b3c — headlines\n…`}
                rows={8}
                className="text-xs font-mono"
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={handlePasteFromClipboard} className="gap-1.5">
                  <ClipboardPaste className="h-3.5 w-3.5" /> Paste from clipboard
                </Button>
                <Button type="button" size="sm" onClick={handleParse} disabled={!text.trim()} className="gap-1.5">
                  <Wand2 className="h-3.5 w-3.5" /> Parse
                </Button>
                {text && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setText(""); setPreview(null); }} className="gap-1.5 text-muted-foreground">
                    <X className="h-3.5 w-3.5" /> Clear
                  </Button>
                )}
              </div>
            </div>

            {preview && (
              <div className="rounded-lg border border-border bg-card p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">
                    Parsed {changes.length} section{changes.length === 1 ? "" : "s"}
                  </p>
                  <Button type="button" size="sm" onClick={handleApply} disabled={changes.length === 0} className="gap-1.5">
                    <Check className="h-3.5 w-3.5" /> Apply to form
                  </Button>
                </div>
                {changes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No sections detected. Make sure the output uses <code className="bg-muted px-1 rounded">## SECTION NAME</code> headers from the Master Prompt.
                  </p>
                ) : (
                  <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    {changes.map((c) => (
                      <li key={c.field} className="flex items-baseline gap-2">
                        <Check className="h-3 w-3 text-success shrink-0" />
                        <span className="text-foreground font-medium">{c.field}</span>
                        <span className="text-muted-foreground truncate">{c.value}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-[11px] text-muted-foreground border-t border-border/50 pt-2">
                  Existing field values are preserved — only empty fields get filled. Asset tags map by their index in the form's gallery.
                </p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
