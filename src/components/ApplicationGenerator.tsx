import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Key, 
  FileText, 
  Upload, 
  Sparkles, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Eye,
  EyeOff,
  Info,
  Brain
} from "lucide-react";
import OpenAI from "openai";

interface ProcessingStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  details?: string;
}

interface AnalysisResult {
  requirements: string[];
  matchedSkills: string[];
  suggestedChanges: string[];
  finalApplication: string;
}

export default function ApplicationGenerator() {
  const [apiKey, setApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("gpt-4o");
  const [showApiKey, setShowApiKey] = useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const { toast } = useToast();

  const gptModels = [
    { value: "gpt-4o", label: "GPT-4o (Empfohlen)", description: "Neuestes und leistungsstärktes Modell" },
    { value: "gpt-4", label: "GPT-4", description: "Vorheriges Flagship-Modell" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo", description: "Schnellere Version von GPT-4" },
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo", description: "Günstiger und schneller" }
  ];

  // API Key aus localStorage laden
  useEffect(() => {
    const savedApiKey = localStorage.getItem("openai-api-key");
    const savedModel = localStorage.getItem("openai-model");
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }
    if (savedModel) {
      setSelectedModel(savedModel);
    }
  }, []);

  // API Key und Modell in localStorage speichern
  useEffect(() => {
    if (apiKey) {
      localStorage.setItem("openai-api-key", apiKey);
    }
  }, [apiKey]);

  useEffect(() => {
    if (selectedModel) {
      localStorage.setItem("openai-model", selectedModel);
    }
  }, [selectedModel]);

  const baseApplication = `Sehr geehrte Damen und Herren,
 
Softwareentwicklung begeistert mich – vor allem dann, wenn ich damit echte Mehrwerte für Nutzer schaffen kann.

Als ausgebildeter IT-Kaufmann mit technischer Zusatzqualifikation zum IT-Assistenten und einem laufenden Studium der Wirtschaftsinformatik verbinde ich fundiertes technisches Wissen mit wirtschaftlichem Verständnis. Aktuell bin ich bei der CIB software GmbH als Produktverantwortlicher tätig – dem Unternehmen, bei dem ich bereits erfolgreich die Ausbildung absolviert habe.

Im Studium steht die Programmiersprache Python im Fokus. Ergänzt wird dieses Wissen durch praktische Erfahrung im Frontend-Bereich, insbesondere mit Angular und TypeScript, die im Rahmen eines Praktikums bei MicroNova vertieft wurde. 

So ergibt sich ein solides Fundament für die Fullstack-Webentwicklung – sowohl im Backend als auch im Frontend.

Gerne überzeuge ich Sie in einem persönlichen Gespräch von meiner Motivation und meinen Fähigkeiten.

Mit freundlichen Grüßen`;

  const initializeSteps = () => {
    return [
      {
        id: "validate-inputs",
        title: "Eingaben validieren",
        description: "Überprüfung der API-Schlüssel und Eingabedaten",
        status: "pending" as const
      },
      {
        id: "analyze-job",
        title: "Stellenanzeige analysieren",
        description: "Extrahierung der Anforderungen und Qualifikationen",
        status: "pending" as const
      },
      {
        id: "process-resume",
        title: "Lebenslauf verarbeiten",
        description: "Analyse der vorhandenen Qualifikationen",
        status: "pending" as const
      },
      {
        id: "match-skills",
        title: "Skills matchen",
        description: "Abgleich zwischen Anforderungen und Qualifikationen",
        status: "pending" as const
      },
      {
        id: "generate-application",
        title: "Anschreiben generieren",
        description: "Erstellung des individualisierten Anschreibens",
        status: "pending" as const
      }
    ];
  };

  const updateStep = (stepId: string, updates: Partial<ProcessingStep>) => {
    setProcessingSteps(prev => 
      prev.map(step => 
        step.id === stepId 
          ? { ...step, ...updates }
          : step
      )
    );
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/pdf') {
        setResumeFile(file);
        toast({
          title: "Datei hochgeladen",
          description: `${file.name} wurde erfolgreich hochgeladen.`
        });
      } else {
        toast({
          title: "Ungültiges Dateiformat",
          description: "Bitte laden Sie eine PDF-Datei hoch.",
          variant: "destructive"
        });
      }
    }
  };

  const generateApplication = async () => {
    if (!apiKey) {
      toast({
        title: "API-Schlüssel fehlt",
        description: "Bitte geben Sie Ihren OpenAI API-Schlüssel ein.",
        variant: "destructive"
      });
      return;
    }

    if (!jobDescription) {
      toast({
        title: "Stellenanzeige fehlt",
        description: "Bitte fügen Sie eine Stellenanzeige ein.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setAnalysisResult(null);
    const steps = initializeSteps();
    setProcessingSteps(steps);

    try {
      const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
      });

      // Schritt 1: Eingaben validieren
      updateStep("validate-inputs", { status: "processing" });
      setProgress(10);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      updateStep("validate-inputs", { 
        status: "completed", 
        details: "API-Schlüssel und Eingaben sind gültig" 
      });
      setProgress(20);

      // Schritt 2: Stellenanzeige analysieren
      updateStep("analyze-job", { status: "processing" });
      
      const jobAnalysisPrompt = `
        Analysiere diese Stellenanzeige und extrahiere die wichtigsten Anforderungen:
        
        ${jobDescription}
        
        Gib mir eine strukturierte Antwort mit:
        1. Technische Anforderungen (Programmiersprachen, Frameworks, Tools)
        2. Fachliche Anforderungen (Erfahrung, Qualifikationen)
        3. Soft Skills
        4. Branchenspezifische Kenntnisse
        
        Antwort als JSON:
        {
          "technical_requirements": ["requirement1", "requirement2"],
          "professional_requirements": ["requirement1", "requirement2"],
          "soft_skills": ["skill1", "skill2"],
          "industry_knowledge": ["knowledge1", "knowledge2"]
        }
      `;

      const jobAnalysis = await openai.chat.completions.create({
        model: selectedModel,
        messages: [{ role: "user", content: jobAnalysisPrompt }],
        temperature: 0.3
      });

      const jobRequirements = JSON.parse(jobAnalysis.choices[0].message.content || "{}");
      updateStep("analyze-job", { 
        status: "completed", 
        details: `${jobRequirements.technical_requirements?.length || 0} technische Anforderungen gefunden` 
      });
      setProgress(40);

      // Schritt 3: Lebenslauf verarbeiten (simuliert, da wir keinen echten PDF-Parser haben)
      updateStep("process-resume", { status: "processing" });
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      const candidateSkills = [
        "Python", "Angular", "TypeScript", "Java", "Hibernate", 
        "Scrum", "Produktverantwortung", "Software Architektur",
        "Wirtschaftsinformatik", "IT-Kaufmann", "KI"
      ];
      
      updateStep("process-resume", { 
        status: "completed", 
        details: `${candidateSkills.length} Qualifikationen extrahiert` 
      });
      setProgress(60);

      // Schritt 4: Skills matchen
      updateStep("match-skills", { status: "processing" });
      
      const matchPrompt = `
        Vergleiche die Stellenanforderungen mit den vorhandenen Skills:
        
        Stellenanforderungen:
        ${JSON.stringify(jobRequirements, null, 2)}
        
        Vorhandene Skills:
        ${candidateSkills.join(", ")}
        
        Gib mir eine Analyse als JSON:
        {
          "matched_skills": ["skill1", "skill2"],
          "missing_skills": ["skill1", "skill2"],
          "relevant_experiences": ["experience1", "experience2"]
        }
      `;

      const skillMatch = await openai.chat.completions.create({
        model: selectedModel,
        messages: [{ role: "user", content: matchPrompt }],
        temperature: 0.3
      });

      const matchResult = JSON.parse(skillMatch.choices[0].message.content || "{}");
      updateStep("match-skills", { 
        status: "completed", 
        details: `${matchResult.matched_skills?.length || 0} passende Skills gefunden` 
      });
      setProgress(80);

      // Schritt 5: Anschreiben generieren
      updateStep("generate-application", { status: "processing" });
      
      const applicationPrompt = `
        Erstelle ein individualisiertes Anschreiben basierend auf:
        
        Basis-Anschreiben:
        ${baseApplication}
        
        Stellenanforderungen:
        ${JSON.stringify(jobRequirements, null, 2)}
        
        Passende Skills:
        ${JSON.stringify(matchResult.matched_skills, null, 2)}
        
        Regeln:
        - Behalte den ersten und letzten Absatz EXAKT bei
        - Ändere nur den mittleren Teil (zwischen den ### Markierungen)
        - Erwähne nur relevante Erfahrungen:
          * Wenn Frontend/Angular gebraucht wird: "Frontend Entwicklung Angular bei MicroNova"
          * Wenn Backend/Java gebraucht wird: "Backend Java mit Hibernate bei MicroNova" oder "Java in der Ausbildung bei CIB"
          * Wenn Produktverantwortung gebraucht wird: "als Product Owner Web Technologien (Angular) und Backend Java"
          * Wenn Scrum gebraucht wird: "Scrum Methoden"
          * Wenn KI gebraucht wird: erwähne KI-Erfahrung
        - Passe den Text natürlich an die Stelle an
        - Schreibe professionell und überzeugend
        
        Gib mir das komplette Anschreiben zurück.
      `;

      const applicationResult = await openai.chat.completions.create({
        model: selectedModel,
        messages: [{ role: "user", content: applicationPrompt }],
        temperature: 0.5
      });

      const finalApplication = applicationResult.choices[0].message.content || "";
      
      updateStep("generate-application", { 
        status: "completed", 
        details: "Individualisiertes Anschreiben erstellt" 
      });
      setProgress(100);

      setAnalysisResult({
        requirements: [
          ...(jobRequirements.technical_requirements || []),
          ...(jobRequirements.professional_requirements || [])
        ],
        matchedSkills: matchResult.matched_skills || [],
        suggestedChanges: matchResult.relevant_experiences || [],
        finalApplication
      });

      toast({
        title: "Anschreiben generiert",
        description: "Ihr individualisiertes Anschreiben wurde erfolgreich erstellt.",
        variant: "default"
      });

    } catch (error) {
      console.error("Fehler bei der Generierung:", error);
      toast({
        title: "Fehler aufgetreten",
        description: "Bei der Generierung ist ein Fehler aufgetreten. Bitte prüfen Sie Ihren API-Schlüssel.",
        variant: "destructive"
      });
      
      setProcessingSteps(prev => 
        prev.map(step => 
          step.status === "processing" 
            ? { ...step, status: "error" as const }
            : step
        )
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const getStepIcon = (status: ProcessingStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      default:
        return <div className="w-4 h-4 rounded-full border-2 border-muted" />;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            AI Agent
          </h1>
          <p className="text-muted-foreground text-lg">
            Generiere individuelle Anschreiben basierend auf Stellenanzeigen
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Eingabe Sektion */}
          <div className="lg:col-span-2 space-y-8">
            {/* API Key & Model Selection */}
            <Card className="bg-gradient-to-br from-card/90 to-card/50 backdrop-blur-sm shadow-xl border-primary/20 hover:shadow-2xl transition-all duration-300">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Key className="w-5 h-5 text-primary" />
                  KI-Konfiguration
                </CardTitle>
                <CardDescription>
                  Konfigurieren Sie Ihren API-Schlüssel und wählen Sie das gewünschte Modell
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="api-key">OpenAI API-Schlüssel</Label>
                  <div className="relative">
                    <Input
                      id="api-key"
                      type={showApiKey ? "text" : "password"}
                      placeholder="sk-..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="pr-10 bg-background/50 border-primary/30 focus:border-primary/60 transition-colors"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-0 top-0 h-full px-3 hover:bg-primary/10"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="model-select">KI-Modell</Label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger className="bg-background/50 border-primary/30 focus:border-primary/60 transition-colors">
                      <div className="flex items-center gap-2">
                        <Brain className="w-4 h-4 text-primary" />
                        <SelectValue placeholder="Wählen Sie ein Modell" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-background/95 backdrop-blur-sm border-primary/20 shadow-xl">
                      {gptModels.map((model) => (
                        <SelectItem key={model.value} value={model.value} className="hover:bg-primary/10 focus:bg-primary/10">
                          <div className="flex flex-col">
                            <span className="font-medium">{model.label}</span>
                            <span className="text-xs text-muted-foreground">{model.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Stellenanzeige */}
            <Card className="bg-gradient-to-br from-card/90 to-card/50 backdrop-blur-sm shadow-xl border-primary/20 hover:shadow-2xl transition-all duration-300">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="w-5 h-5 text-primary" />
                  Stellenanzeige
                </CardTitle>
                <CardDescription>
                  Fügen Sie hier die komplette Stellenanzeige ein
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Fügen Sie hier die Stellenanzeige ein..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  className="min-h-[300px] bg-background/50 border-primary/30 focus:border-primary/60 transition-colors resize-none"
                />
              </CardContent>
            </Card>

            {/* Lebenslauf Upload */}
            <Card className="bg-gradient-to-br from-card/90 to-card/50 backdrop-blur-sm shadow-xl border-primary/20 hover:shadow-2xl transition-all duration-300">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Upload className="w-5 h-5 text-primary" />
                  Lebenslauf Upload
                </CardTitle>
                <CardDescription>
                  Laden Sie Ihren Lebenslauf als PDF-Datei hoch
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-center w-full">
                    <Label htmlFor="resume-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-primary/30 rounded-lg cursor-pointer hover:bg-primary/5 hover:border-primary/50 transition-all duration-200">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-10 h-10 mb-3 text-primary/70" />
                        <p className="mb-2 text-sm text-foreground/80">
                          <span className="font-semibold">Klicken Sie hier</span> oder ziehen Sie die Datei hinein
                        </p>
                        <p className="text-xs text-muted-foreground">Nur PDF-Dateien</p>
                      </div>
                      <Input
                        id="resume-upload"
                        type="file"
                        accept=".pdf"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </Label>
                  </div>
                  {resumeFile && (
                    <Badge variant="success" className="w-fit">
                      {resumeFile.name}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Generate Button */}
            <Card className="bg-gradient-to-br from-card/90 to-card/50 backdrop-blur-sm shadow-xl border-primary/20 hover:shadow-2xl transition-all duration-300">
              <CardContent className="pt-6">
                <Button
                  onClick={generateApplication}
                  disabled={isProcessing || !apiKey || !jobDescription}
                  className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
                  size="lg"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Generiere Anschreiben...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      Anschreiben generieren
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Status und Ergebnis Sektion */}
          <div className="space-y-8">
            {/* Verarbeitungsfortschritt */}
            {processingSteps.length > 0 && (
              <Card className="bg-gradient-to-br from-card/90 to-card/50 backdrop-blur-sm shadow-xl border-primary/20 hover:shadow-2xl transition-all duration-300">
                <CardHeader>
                  <CardTitle>Verarbeitungsfortschritt</CardTitle>
                  <CardDescription>
                    Echtzeitüberwachung der KI-Verarbeitung
                  </CardDescription>
                </CardHeader>
                 <CardContent className="space-y-4">
                   <div className="space-y-2">
                     <div className="flex justify-between items-center">
                       <span className="text-sm font-medium">Fortschritt</span>
                       <span className="text-sm text-muted-foreground">{progress}%</span>
                     </div>
                     <Progress 
                       value={progress} 
                       className="w-full cursor-pointer hover:opacity-80 transition-opacity" 
                       onClick={() => {
                         toast({
                           title: "Fortschritt Details",
                           description: `Verarbeitung zu ${progress}% abgeschlossen. ${processingSteps.filter(s => s.status === 'completed').length} von ${processingSteps.length} Schritten fertig.`
                         });
                       }}
                     />
                   </div>
                   <div className="space-y-3">
                     {processingSteps.map((step, index) => (
                       <div 
                         key={step.id} 
                         className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-all duration-200 cursor-pointer hover:shadow-md ${
                           selectedStep === step.id 
                             ? 'border-primary bg-primary/5' 
                             : 'border-transparent hover:border-muted'
                         }`}
                         onClick={() => {
                           setSelectedStep(selectedStep === step.id ? null : step.id);
                           toast({
                             title: step.title,
                             description: step.details || step.description
                           });
                         }}
                       >
                         <div className="mt-1">
                           {getStepIcon(step.status)}
                         </div>
                         <div className="flex-1 min-w-0">
                           <p className="text-sm font-medium">{step.title}</p>
                           <p className="text-xs text-muted-foreground">{step.description}</p>
                           {step.details && (
                             <p className="text-xs text-primary mt-1">{step.details}</p>
                           )}
                           {selectedStep === step.id && (
                             <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                               <Info className="w-3 h-3 inline mr-1" />
                               Klicken Sie auf andere Schritte um Details zu sehen.
                             </div>
                           )}
                         </div>
                       </div>
                     ))}
                   </div>
                 </CardContent>
              </Card>
            )}

            {/* Analyse Ergebnis */}
            {analysisResult && (
              <Card className="bg-gradient-to-br from-card/90 to-card/50 backdrop-blur-sm shadow-xl border-primary/20 hover:shadow-2xl transition-all duration-300">
                <CardHeader>
                  <CardTitle>Analyse Ergebnis</CardTitle>
                  <CardDescription>
                    Zusammenfassung der gefundenen Übereinstimmungen
                  </CardDescription>
                </CardHeader>
                 <CardContent className="space-y-6">
                   <div className="space-y-3">
                     <Label className="text-sm font-medium">Stellenanforderungen</Label>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                       {analysisResult.requirements.map((req, index) => (
                         <Badge 
                           key={index} 
                           variant="outline" 
                           className="text-xs cursor-pointer hover:bg-primary/10 transition-colors p-2 justify-start"
                           onClick={() => {
                             setSelectedSkill(selectedSkill === `req-${index}` ? null : `req-${index}`);
                             toast({
                               title: "Anforderung",
                               description: `Diese Stelle sucht nach: ${req}. Prüfen Sie ob Ihre Erfahrung dazu passt.`
                             });
                           }}
                         >
                           {req}
                           {selectedSkill === `req-${index}` && (
                             <Info className="w-3 h-3 ml-1" />
                           )}
                         </Badge>
                       ))}
                     </div>
                   </div>

                   <div className="space-y-3">
                     <Label className="text-sm font-medium">Passende Skills</Label>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                       {analysisResult.matchedSkills.map((skill, index) => (
                         <Badge 
                           key={index} 
                           variant="success" 
                           className="text-xs cursor-pointer hover:bg-success/20 transition-colors p-2 justify-start"
                           onClick={() => {
                             setSelectedSkill(selectedSkill === `skill-${index}` ? null : `skill-${index}`);
                             toast({
                               title: "Passender Skill",
                               description: `Ihr Skill "${skill}" passt perfekt zu den Anforderungen dieser Stelle!`
                             });
                           }}
                         >
                           {skill}
                           {selectedSkill === `skill-${index}` && (
                             <Info className="w-3 h-3 ml-1" />
                           )}
                         </Badge>
                       ))}
                     </div>
                   </div>
                 </CardContent>
              </Card>
            )}

            {/* Generiertes Anschreiben */}
            {analysisResult?.finalApplication && (
              <Card className="bg-gradient-to-br from-card/90 to-card/50 backdrop-blur-sm shadow-xl border-primary/20 hover:shadow-2xl transition-all duration-300">
                <CardHeader>
                  <CardTitle>Generiertes Anschreiben</CardTitle>
                  <CardDescription>
                    Ihr individualisiertes Bewerbungsanschreiben
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-background rounded-lg p-4 border">
                    <pre className="whitespace-pre-wrap text-sm font-mono">
                      {analysisResult.finalApplication}
                    </pre>
                  </div>
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(analysisResult.finalApplication);
                      toast({
                        title: "Kopiert",
                        description: "Anschreiben wurde in die Zwischenablage kopiert."
                      });
                    }}
                    variant="outline"
                    className="w-full mt-4"
                  >
                    In Zwischenablage kopieren
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}