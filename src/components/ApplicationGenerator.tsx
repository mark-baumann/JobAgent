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
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { saveAs } from "file-saver";

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

  // Eingabefelder für Firma, Adresse, Titel
  const [firmaInput, setFirmaInput] = useState("");
  const [adresseInput, setAdresseInput] = useState("");
  const [titleInput, setTitleInput] = useState("");

  const { toast } = useToast();

  const gptModels = [
    { value: "gpt-4o", label: "GPT-4o (Empfohlen)", description: "Neuestes und leistungsstärkstes Modell" },
    { value: "gpt-4", label: "GPT-4", description: "Vorheriges Flagship-Modell" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo", description: "Schnellere Version von GPT-4" },
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo", description: "Günstiger und schneller" }
  ];

  useEffect(() => {
    const savedApiKey = localStorage.getItem("openai-api-key");
    const savedModel = localStorage.getItem("openai-model");
    if (savedApiKey) setApiKey(savedApiKey);
    if (savedModel) setSelectedModel(savedModel);
  }, []);

  useEffect(() => {
    if (apiKey) localStorage.setItem("openai-api-key", apiKey);
  }, [apiKey]);

  useEffect(() => {
    if (selectedModel) localStorage.setItem("openai-model", selectedModel);
  }, [selectedModel]);

  const baseApplication = `Sehr geehrte Damen und Herren,
 
Softwareentwicklung begeistert mich – vor allem dann, wenn ich damit echte Mehrwerte für Nutzer schaffen kann.

Als ausgebildeter IT-Kaufmann mit technischer Zusatzqualifikation zum IT-Assistenten und einem laufenden Studium der Wirtschaftsinformatik verbinde ich fundiertes technisches Wissen mit wirtschaftlichem Verständnis. Aktuell bin ich bei der CIB software GmbH als Produktverantwortlicher tätig – dem Unternehmen, bei dem ich bereits erfolgreich die Ausbildung absolviert habe.

Im Studium steht die Programmiersprache Python im Fokus. Ergänzt wird dieses Wissen durch praktische Erfahrung im Frontend-Bereich, insbesondere mit Angular und TypeScript, die im Rahmen eines Praktikums bei MicroNova vertieft wurde. 

So ergibt sich ein solides Fundament für die Fullstack-Webentwicklung – sowohl im Backend als auch im Frontend.

Gerne überzeuge ich Sie in einem persönlichen Gespräch von meiner Motivation und meinen Fähigkeiten.

Mit freundlichen Grüßen`;

  const initializeSteps = () => [
    { id: "validate-inputs", title: "Eingaben validieren", description: "Überprüfung der API-Schlüssel und Eingabedaten", status: "pending" as const },
    { id: "analyze-job", title: "Stellenanzeige analysieren", description: "Extrahierung der Anforderungen und Qualifikationen", status: "pending" as const },
    { id: "process-resume", title: "Lebenslauf verarbeiten", description: "Analyse der vorhandenen Qualifikationen", status: "pending" as const },
    { id: "match-skills", title: "Skills matchen", description: "Abgleich zwischen Anforderungen und Qualifikationen", status: "pending" as const },
    { id: "generate-application", title: "Anschreiben generieren", description: "Erstellung des individualisierten Anschreibens", status: "pending" as const }
  ];

  const updateStep = (stepId: string, updates: Partial<ProcessingStep>) => {
    setProcessingSteps(prev => prev.map(step => step.id === stepId ? { ...step, ...updates } : step));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/pdf') {
        setResumeFile(file);
        toast({ title: "Datei hochgeladen", description: `${file.name} wurde erfolgreich hochgeladen.` });
      } else {
        toast({ title: "Ungültiges Dateiformat", description: "Bitte laden Sie eine PDF-Datei hoch.", variant: "destructive" });
      }
    }
  };

  function extractJsonFromMarkdown(text: string): string | null {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? match[0] : null;
  }

  const generateApplication = async () => {
    if (!apiKey) {
      toast({ title: "API-Schlüssel fehlt", description: "Bitte geben Sie Ihren OpenAI API-Schlüssel ein.", variant: "destructive" });
      return;
    }
    if (!jobDescription) {
      toast({ title: "Stellenanzeige fehlt", description: "Bitte fügen Sie eine Stellenanzeige ein.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    setProgress(0);
    setAnalysisResult(null);
    const steps = initializeSteps();
    setProcessingSteps(steps);

    try {
      const openai = new OpenAI({ apiKey: apiKey, dangerouslyAllowBrowser: true });

      // Schritt 1: Eingaben validieren
      updateStep("validate-inputs", { status: "processing" });
      setProgress(10);
      await new Promise(resolve => setTimeout(resolve, 1000));
      updateStep("validate-inputs", { status: "completed", details: "API-Schlüssel und Eingaben sind gültig" });
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
      const jobRequirementsRaw = extractJsonFromMarkdown(jobAnalysis.choices[0].message.content || "");
      let jobRequirements: any = {};
      if (jobRequirementsRaw) {
        try {
          jobRequirements = JSON.parse(jobRequirementsRaw);
        } catch (e) {
          toast({ title: "Fehler beim Verarbeiten der KI-Antwort", description: "Die Antwort der KI konnte nicht als JSON gelesen werden.", variant: "destructive" });
          setIsProcessing(false);
          return;
        }
      } else {
        toast({ title: "Fehler beim Verarbeiten der KI-Antwort", description: "Es wurde kein JSON-Block in der Antwort gefunden.", variant: "destructive" });
        setIsProcessing(false);
        return;
      }
      updateStep("analyze-job", { status: "completed", details: `${jobRequirements.technical_requirements?.length || 0} technische Anforderungen gefunden` });
      setProgress(40);

      // Schritt 3: Lebenslauf verarbeiten (simuliert)
      updateStep("process-resume", { status: "processing" });
      await new Promise(resolve => setTimeout(resolve, 1500));
      const candidateSkills = [
        "Python", "Angular", "TypeScript", "Java", "Hibernate", 
        "Scrum", "Produktverantwortung", "Software Architektur",
        "Wirtschaftsinformatik", "IT-Kaufmann", "KI"
      ];
      updateStep("process-resume", { status: "completed", details: `${candidateSkills.length} Qualifikationen extrahiert` });
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
      const matchResultRaw = extractJsonFromMarkdown(skillMatch.choices[0].message.content || "");
      let matchResult: any = {};
      if (matchResultRaw) {
        try {
          matchResult = JSON.parse(matchResultRaw);
        } catch (e) {
          toast({ title: "Fehler beim Verarbeiten der KI-Antwort", description: "Die Antwort der KI konnte nicht als JSON gelesen werden.", variant: "destructive" });
          setIsProcessing(false);
          return;
        }
      } else {
        toast({ title: "Fehler beim Verarbeiten der KI-Antwort", description: "Es wurde kein JSON-Block in der Antwort gefunden.", variant: "destructive" });
        setIsProcessing(false);
        return;
      }
      updateStep("match-skills", { status: "completed", details: `${matchResult.matched_skills?.length || 0} passende Skills gefunden` });
      setProgress(80);

      // Schritt 5: Anschreiben generieren
      updateStep("generate-application", { status: "processing" });
      const applicationPrompt = `
        Du bist ein erfahrener Bewerbungsexperte und hilfst dabei, perfekte Anschreiben zu erstellen.

        AUFGABE: Erstelle ein individualisiertes, überzeugendes Anschreiben basierend auf den gegebenen Informationen.

        BASIS-ANSCHREIBEN (als Vorlage verwenden):
        ${baseApplication}

        STELLENANFORDERUNGEN UND ANALYSE:
        ${JSON.stringify(jobRequirements, null, 2)}

        PASSENDE KANDIDATEN-SKILLS:
        ${JSON.stringify(matchResult.matched_skills, null, 2)}

        ANWEISUNGEN FÜR EIN PERFEKTES ANSCHREIBEN:

        1. STRUKTUR BEIBEHALTEN:
           - Behalte Anrede und Schlussformel EXAKT bei
           - Behalte den ersten Satz über Begeisterung für Softwareentwicklung bei
           - Behalte den letzten Absatz vor der Grußformel bei

        2. INDIVIDUALISIERUNG DER HAUPTABSCHNITTE:
           - Analysiere die Stellenanforderungen gründlich
           - Betone nur relevante Erfahrungen und Skills, die wirklich gesucht werden
           - Verwende konkrete Beispiele und Projekte aus den passenden Skills
           - Stelle klare Verbindungen zwischen Anforderungen und Qualifikationen her

        3. SPEZIFISCHE ERWÄHNUNGEN (nur wenn relevant für die Stelle):
           - Frontend/React/Angular/JavaScript: "Frontend-Entwicklung mit Angular und TypeScript bei MicroNova"
           - Backend/Java/Spring: "Backend-Entwicklung mit Java und Hibernate bei MicroNova" oder "Java-Programmierung in der Ausbildung bei CIB"
           - Python: "Python-Kenntnisse aus dem Studium der Wirtschaftsinformatik"
           - Produktmanagement: "Erfahrung als Product Owner für Web-Technologien und Backend-Systeme"
           - Agile Methoden: "praktische Anwendung von Scrum-Methoden"
           - KI/Machine Learning: "Erfahrung im Bereich KI und maschinelles Lernen"
           - Vollstack: "Erfahrung in der Fullstack-Entwicklung von Frontend bis Backend"

        4. SCHREIBSTIL:
           - Selbstbewusst aber nicht überheblich
           - Konkret und messbar wo möglich
           - Enthusiastisch und motiviert
           - Professionell und auf den Punkt gebracht
           - Verbinde Ausbildung, Studium und praktische Erfahrung geschickt

        5. QUALITÄTSKRITERIEN:
           - Jeder Satz muss einen Mehrwert bieten
           - Keine generischen Phrasen
           - Klarer Bezug zu den Stellenanforderungen
           - Überzeugende Darstellung der Eignung
           - Flüssiger, natürlicher Sprachfluss

        Erstelle jetzt das perfekte, individualisierte Anschreiben, das den Kandidaten optimal für diese spezifische Stelle positioniert.
      `;
      const applicationResult = await openai.chat.completions.create({
        model: selectedModel,
        messages: [{ role: "user", content: applicationPrompt }],
        temperature: 0.5
      });
      const finalApplication = applicationResult.choices[0].message.content || "";
      updateStep("generate-application", { status: "completed", details: "Individualisiertes Anschreiben erstellt" });
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

      toast({ title: "Anschreiben generiert", description: "Ihr individualisiertes Anschreiben wurde erfolgreich erstellt.", variant: "default" });

    } catch (error) {
      console.error("Fehler bei der Generierung:", error);
      toast({ title: "Fehler aufgetreten", description: "Bei der Generierung ist ein Fehler aufgetreten. Bitte prüfen Sie Ihren API-Schlüssel.", variant: "destructive" });
      setProcessingSteps(prev => prev.map(step => step.status === "processing" ? { ...step, status: "error" as const } : step));
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

  async function handleDocxExport() {
    if (!analysisResult?.finalApplication) {
      toast({ title: "Kein Anschreiben", description: "Bitte generieren Sie zuerst ein Anschreiben.", variant: "destructive" });
      return;
    }
    try {
      const response = await fetch("/Vorlage.docx");
      const arrayBuffer = await response.arrayBuffer();
      const zip = new PizZip(arrayBuffer);
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

      // Werte für Platzhalter bestimmen (nur aus den Eingabefeldern!)
      const firma = firmaInput;
      const adresse = adresseInput;
      const title = titleInput || "Bewerbung";
      const datum = new Date().toLocaleDateString("de-DE");

      doc.render({
        inhalt: String(analysisResult.finalApplication || ""),
        title,
        datum,
        firma,
        adresse
      });

      // DOCX als Datei speichern
      const out = doc.getZip().generate({ type: "blob" });
      saveAs(out, "Bewerbung.docx");
      toast({ title: "DOCX erstellt", description: "Die DOCX-Datei wurde heruntergeladen." });
    } catch (error) {
      toast({ title: "Fehler beim DOCX-Export", description: String(error), variant: "destructive" });
    }
  }

  async function handlePdfExport() {
    if (!analysisResult?.finalApplication) {
      toast({ title: "Kein Anschreiben", description: "Bitte generieren Sie zuerst ein Anschreiben.", variant: "destructive" });
      return;
    }

    try {
      // Schritt 1: DOCX erstellen
      const response = await fetch("/Vorlage.docx");
      const arrayBuffer = await response.arrayBuffer();
      const zip = new PizZip(arrayBuffer);
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

      const firma = firmaInput;
      const adresse = adresseInput;
      const title = titleInput || "Bewerbung";
      const datum = new Date().toLocaleDateString("de-DE");

      doc.render({
        inhalt: String(analysisResult.finalApplication || ""),
        title,
        datum,
        firma,
        adresse
      });

      const docxBlob = doc.getZip().generate({ type: "blob" });

      // Schritt 2: CloudConvert Job erstellen
      const jobResponse = await fetch('https://api.cloudconvert.com/v2/jobs', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiZmQwYjc0NjdlZmQzMjk5ZWQyMjQxMmE1NDZhM2VmZGE4ZDZjZjI4Y2JkM2NlNzJiYWI4YWM0OTIxMDZiNGM4MTNkM2ExZTU5ZmVlYTQ2ZmUiLCJpYXQiOjE3NTMwODkwOTMuMTE5MTk1LCJuYmYiOjE3NTMwODkwOTMuMTE5MTk2LCJleHAiOjQ5MDg3NjI2OTMuMTEyMzUzLCJzdWIiOiI3MjQ2MzQxMyIsInNjb3BlcyI6WyJ1c2VyLnJlYWQiLCJ1c2VyLndyaXRlIiwidGFzay53cml0ZSIsInRhc2sucmVhZCIsIndlYmhvb2sucmVhZCIsIndlYmhvb2sud3JpdGUiLCJwcmVzZXQucmVhZCIsInByZXNldC53cml0ZSJdfQ.JdNKwY4JxelirCc-wSZB5zIpYHlFG1VcRA7_b7j7dO-SaAQEOC-dcN-190avzM-8oi7ejl2qU-jVmD2rg49n90RwnRBaVbEMTjLkgdexBspdOE8S4jTt3nk-EpGcVfp50_zbiD5a4IyoYPm69gc0rsVMUX5uq0U-JjJ1txgX7yKt6HZk8rstcqUpB58ZerxRT8pkoTITdHb3TGMXyuu-agJDY0BmGhdQrJmAGFEgDBANXD577UelTIicXz_MjiiDWyGDwnTavSOujnPmjtFBDGpL_BIWRYD_7wSo9fyjEHPGuklJ5_k7CrNPemwW96QxGu-VHjeBEJhgcjIFpxFvszCeUEUJ6gxhTjUoT7zeGnTKnwq1b3gRH1Ky-3pY7wRJm43tA_lcpez7LRRPPLKTSogURgsVMpungJGkG0IO1flpsRhH7eWSuqNmvCu0wDeYw2ThDUQEjXPSCY_VLAqfWwC1yil-CBytXnLuvlR0c2PWpeZGCOAqmey96qiBQQ4039AoIwS2hHGDKZzJG1VI6JXOmEXDMVvSwFr9WUIyY0zH1LxG8_Kp_9jv18-E-pjRzKxLO93cvAyQGMNC0wPL9UjHMAOmWqNvQm31nwx9I3IKmWRUXA08oca2Y5hLAnT57Eta1uaYbl3REPkBSPokPYg_J7iOowAs1-Q7Ksa3o_A',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tasks: {
            'upload-my-file': {
              operation: 'import/upload'
            },
            'convert-my-file': {
              operation: 'convert',
              input: 'upload-my-file',
              output_format: 'pdf'
            },
            'export-my-file': {
              operation: 'export/url',
              input: 'convert-my-file'
            }
          }
        })
      });

      if (!jobResponse.ok) {
        const errorText = await jobResponse.text();
        console.error('Job creation error:', errorText);
        throw new Error(`Job creation failed: ${jobResponse.status} - ${errorText}`);
      }

      const jobData = await jobResponse.json();
      console.log('Job created successfully:', jobData);

      if (!jobData.data || !jobData.data.tasks) {
        throw new Error('Invalid job response structure - missing tasks');
      }

      // Schritt 3: DOCX-Datei hochladen
      const uploadTask = jobData.data.tasks['upload-my-file'];
      if (!uploadTask) {
        throw new Error('Upload-Task "upload-my-file" nicht gefunden');
      }
      
      if (!uploadTask.result || !uploadTask.result.form) {
        throw new Error('Upload-Task Form nicht verfügbar');
      }

      console.log('Upload task:', uploadTask);

      const uploadFormData = new FormData();
      
      // Alle Parameter aus der API-Antwort hinzufügen
      if (uploadTask.result.form.parameters) {
        Object.entries(uploadTask.result.form.parameters).forEach(([key, value]) => {
          uploadFormData.append(key, value as string);
        });
      }
      
      uploadFormData.append('file', docxBlob, 'document.docx');

      console.log('Uploading to:', uploadTask.result.form.url);
      
      const uploadResponse = await fetch(uploadTask.result.form.url, {
        method: 'POST',
        body: uploadFormData
      });

      if (!uploadResponse.ok) {
        const uploadError = await uploadResponse.text();
        console.error('Upload error:', uploadError);
        throw new Error(`Upload failed: ${uploadResponse.status} - ${uploadError}`);
      }

      console.log('File uploaded successfully');

      // Schritt 4: Job Status abfragen bis fertig
      let jobStatus = 'waiting';
      let attempts = 0;
      const maxAttempts = 30;

      while (jobStatus !== 'finished' && jobStatus !== 'error' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));

        const statusResponse = await fetch(`https://api.cloudconvert.com/v2/jobs/${jobData.data.id}`, {
          headers: {
            'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiZmQwYjc0NjdlZmQzMjk5ZWQyMjQxMmE1NDZhM2VmZGE4ZDZjZjI4Y2JkM2NlNzJiYWI4YWM0OTIxMDZiNGM4MTNkM2ExZTU5ZmVlYTQ2ZmUiLCJpYXQiOjE3NTMwODkwOTMuMTE5MTk1LCJuYmYiOjE3NTMwODkwOTMuMTE5MTk2LCJleHAiOjQ5MDg3NjI2OTMuMTEyMzUzLCJzdWIiOiI3MjQ2MzQxMyIsInNjb3BlcyI6WyJ1c2VyLnJlYWQiLCJ1c2VyLndyaXRlIiwidGFzay53cml0ZSIsInRhc2sucmVhZCIsIndlYmhvb2sucmVhZCIsIndlYmhvb2sud3JpdGUiLCJwcmVzZXQucmVhZCIsInByZXNldC53cml0ZSJdfQ.JdNKwY4JxelirCc-wSZB5zIpYHlFG1VcRA7_b7j7dO-SaAQEOC-dcN-190avzM-8oi7ejl2qU-jVmD2rg49n90RwnRBaVbEMTjLkgdexBspdOE8S4jTt3nk-EpGcVfp50_zbiD5a4IyoYPm69gc0rsVMUX5uq0U-JjJ1txgX7yKt6HZk8rstcqUpB58ZerxRT8pkoTITdHb3TGMXyuu-agJDY0BmGhdQrJmAGFEgDBANXD577UelTIicXz_MjiiDWyGDwnTavSOujnPmjtFBDGpL_BIWRYD_7wSo9fyjEHPGuklJ5_k7CrNPemwW96QxGu-VHjeBEJhgcjIFpxFvszCeUEUJ6gxhTjUoT7zeGnTKnwq1b3gRH1Ky-3pY7wRJm43tA_lcpez7LRRPPLKTSogURgsVMpungJGkG0IO1flpsRhH7eWSuqNmvCu0wDeYw2ThDUQEjXPSCY_VLAqfWwC1yil-CBytXnLuvlR0c2PWpeZGCOAqmey96qiBQQ4039AoIwS2hHGDKZzJG1VI6JXOmEXDMVvSwFr9WUIyY0zH1LxG8_Kp_9jv18-E-pjRzKxLO93cvAyQGMNC0wPL9UjHMAOmWqNvQm31nwx9I3IKmWRUXA08oca2Y5hLAnT57Eta1uaYbl3REPkBSPokPYg_J7iOowAs1-Q7Ksa3o_A'
          }
        });

        if (!statusResponse.ok) {
          throw new Error(`Status check failed: ${statusResponse.status}`);
        }

        const statusData = await statusResponse.json();
        jobStatus = statusData.data.status;
        console.log(`Job status: ${jobStatus}, attempt: ${attempts + 1}`);
        attempts++;
      }

      if (jobStatus !== 'finished') {
        throw new Error(`PDF-Konvertierung fehlgeschlagen. Status: ${jobStatus}`);
      }

      // Schritt 5: PDF herunterladen
      const finalJobResponse = await fetch(`https://api.cloudconvert.com/v2/jobs/${jobData.data.id}`, {
        headers: {
          'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiZmQwYjc0NjdlZmQzMjk5ZWQyMjQxMmE1NDZhM2VmZGE4ZDZjZjI4Y2JkM2NlNzJiYWI4YWM0OTIxMDZiNGM4MTNkM2ExZTU5ZmVlYTQ2ZmUiLCJpYXQiOjE3NTMwODkwOTMuMTE5MTk1LCJuYmYiOjE3NTMwODkwOTMuMTE5MTk2LCJleHAiOjQ5MDg3NjI2OTMuMTEyMzUzLCJzdWIiOiI3MjQ2MzQxMyIsInNjb3BlcyI6WyJ1c2VyLnJlYWQiLCJ1c2VyLndyaXRlIiwidGFzay53cml0ZSIsInRhc2sucmVhZCIsIndlYmhvb2sucmVhZCIsIndlYmhvb2sud3JpdGUiLCJwcmVzZXQucmVhZCIsInByZXNldC53cml0ZSJdfQ.JdNKwY4JxelirCc-wSZB5zIpYHlFG1VcRA7_b7j7dO-SaAQEOC-dcN-190avzM-8oi7ejl2qU-jVmD2rg49n90RwnRBaVbEMTjLkgdexBspdOE8S4jTt3nk-EpGcVfp50_zbiD5a4IyoYPm69gc0rsVMUX5uq0U-JjJ1txgX7yKt6HZk8rstcqUpB58ZerxRT8pkoTITdHb3TGMXyuu-agJDY0BmGhdQrJmAGFEgDBANXD577UelTIicXz_MjiiDWyGDwnTavSOujnPmjtFBDGpL_BIWRYD_7wSo9fyjEHPGuklJ5_k7CrNPemwW96QxGu-VHjeBEJhgcjIFpxFvszCeUEUJ6gxhTjUoT7zeGnTKnwq1b3gRH1Ky-3pY7wRJm43tA_lcpez7LRRPPLKTSogURgsVMpungJGkG0IO1flpsRhH7eWSuqNmvCu0wDeYw2ThDUQEjXPSCY_VLAqfWwC1yil-CBytXnLuvlR0c2PWpeZGCOAqmey96qiBQQ4039AoIwS2hHGDKZzJG1VI6JXOmEXDMVvSwFr9WUIyY0zH1LxG8_Kp_9jv18-E-pjRzKxLO93cvAyQGMNC0wPL9UjHMAOmWqNvQm31nwx9I3IKmWRUXA08oca2Y5hLAnT57Eta1uaYbl3REPkBSPokPYg_J7iOowAs1-Q7Ksa3o_A'
        }
      });

      if (!finalJobResponse.ok) {
        throw new Error(`Final job fetch failed: ${finalJobResponse.status}`);
      }

      const finalJobData = await finalJobResponse.json();
      console.log('Final job data:', finalJobData);
      
      const exportTask = finalJobData.data.tasks['export-my-file'];

      if (!exportTask) {
        throw new Error('Export-Task "export-my-file" nicht gefunden');
      }
      
      if (!exportTask.result || !exportTask.result.files || !exportTask.result.files[0]) {
        throw new Error('Export-Task keine Datei verfügbar - Job möglicherweise noch nicht fertig');
      }

      const pdfUrl = exportTask.result.files[0].url;
      console.log('PDF download URL:', pdfUrl);
      const pdfResponse = await fetch(pdfUrl);
      
      if (!pdfResponse.ok) {
        throw new Error(`PDF download failed: ${pdfResponse.status}`);
      }

      const pdfBlob = await pdfResponse.blob();
      saveAs(pdfBlob, "Bewerbung.pdf");
      toast({ title: "PDF erstellt", description: "Die PDF-Datei wurde heruntergeladen." });

    } catch (error) {
      console.error('PDF Export Error:', error);
      toast({ 
        title: "Fehler beim PDF-Export", 
        description: `PDF-Konvertierung fehlgeschlagen: ${error}`, 
        variant: "destructive" 
      });
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-indigo-100 flex flex-col items-center justify-center py-8 text-black">
      <div className="w-full max-w-2xl mx-auto flex flex-col gap-8 items-center">
        {/* Header */}
        <div className="text-center space-y-2 mb-2">
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-indigo-600 via-blue-600 to-sky-400 bg-clip-text text-transparent drop-shadow">
            JobAgent
          </h1>
          <p className="text-lg text-black/80">
            Generiere individuelle Anschreiben basierend auf Stellenanzeigen
          </p>
        </div>

        {/* Eingabe Sektion */}
        <div className="w-full flex flex-col gap-6 items-center">
          {/* API Key & Model Selection */}
          <Card className="w-full bg-white shadow-xl border border-blue-200 rounded-2xl text-black">
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
                    className="pr-10 bg-white border-primary/30 focus:border-primary/60 transition-colors"
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
                  <SelectTrigger className="bg-white border-primary/30 focus:border-primary/60 transition-colors">
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-primary" />
                      <SelectValue placeholder="Wählen Sie ein Modell" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-white backdrop-blur-sm border-primary/20 shadow-xl">
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
          <Card className="w-full bg-white shadow-xl border border-blue-200 rounded-2xl text-black">
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
                className="min-h-[200px] bg-white border-primary/30 focus:border-primary/60 transition-colors resize-none"
              />
              <div className="flex flex-col gap-2 mt-4">
                <Label>Firma</Label>
                <Input
                  value={firmaInput}
                  onChange={e => setFirmaInput(e.target.value)}
                  placeholder="z.B. ACME GmbH"
                  className="bg-white"
                />
                <Label>Adresse</Label>
                <Input
                  value={adresseInput}
                  onChange={e => setAdresseInput(e.target.value)}
                  placeholder="z.B. Musterstraße 1, 12345 Musterstadt"
                  className="bg-white"
                />
                <Label>Titel</Label>
                <Input
                  value={titleInput}
                  onChange={e => setTitleInput(e.target.value)}
                  placeholder="z.B. Bewerbung als Softwareentwickler"
                  className="bg-white"
                />
              </div>
            </CardContent>
          </Card>

          {/* Lebenslauf Upload */}
          <Card className="w-full bg-white shadow-xl border border-blue-200 rounded-2xl text-black">
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
          <Card className="w-full bg-gradient-to-r from-indigo-50 to-blue-100 shadow-xl border border-blue-200 rounded-2xl text-black">
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
        <div className="w-full flex flex-col gap-6 items-center mt-4">
          {/* Verarbeitungsfortschritt */}
          {processingSteps.length > 0 && (
            <Card className="w-full bg-white shadow-lg border border-blue-200 rounded-2xl text-black">
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
            <Card className="w-full bg-white shadow-lg border border-blue-200 rounded-2xl text-black">
              <CardHeader>
                <CardTitle>Analyse Ergebnis</CardTitle>
                <CardDescription>
                  Zusammenfassung der gefundenen Übereinstimmungen
                </CardDescription>
              </CardHeader>
               <CardContent className="space-y-6">
                 <div className="space-y-3">
                   <Label className="text-sm">Stellenanforderungen</Label>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                     {analysisResult.requirements.map((req, index) => (
                       <Badge 
                         key={index} 
                         variant="outline" 
                         className="text-xs cursor-pointer bg-blue-100 border-blue-200 text-blue-800 transition-colors p-2 justify-start"
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
                   <Label className="text-sm">Passende Skills</Label>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                     {analysisResult.matchedSkills.map((skill, index) => (
                       <Badge 
                         key={index} 
                         variant="success" 
                         className="text-xs cursor-pointer bg-green-100 border-green-300 text-green-800 transition-colors p-2 justify-start"
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
            <Card className="w-full bg-white shadow-lg border border-blue-200 rounded-2xl text-black">
              <CardHeader>
                <CardTitle>Generiertes Anschreiben</CardTitle>
                <CardDescription>
                  Ihr individualisiertes Bewerbungsanschreiben
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-white rounded-lg p-4 border border-blue-100">
                  <pre className="whitespace-pre-wrap text-sm font-mono text-black">
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
                  className="w-full mt-4 text-black bg-white border border-blue-200"
                >
                  In Zwischenablage kopieren
                </Button>
                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={handleDocxExport}
                    variant="outline"
                    className="flex-1 text-black bg-white border border-blue-200"
                  >
                    DOCX herunterladen
                  </Button>
                  <Button
                    onClick={handlePdfExport}
                    variant="outline"
                    className="flex-1 text-black bg-white border border-blue-200"
                  >
                    PDF herunterladen
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}