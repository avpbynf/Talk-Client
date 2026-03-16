import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  BookText,
  Plus,
  X,
  Trash2,
  Info,
  Sparkles,
  Code,
  MonitorSmartphone,
  ChevronDown,
  ChevronRight,
  Layers,
  FileText,
  Hash,
  GripVertical,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface VocabularyViewProps {
  vocabulary: string[];
  onVocabularyChange: (words: string[]) => void;
}

interface DetectedContext {
  has_real_context: boolean;
  language: string | null;
  symbols: string[];
  workspace: string | null;
  frameworks: string[];
  window_title: string | null;
  domain: string | null;
  vocabulary_prompt: string | null;
  available_languages: string[];
}

function SortableVocabularyItem({
  word,
  onRemove,
}: {
  word: string;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: word });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <span
      ref={setNodeRef}
      style={style}
      className={`inline-flex items-center gap-1 px-3 py-1.5 bg-[oklch(0.20_0.015_260)] rounded-full text-sm group transition-colors hover:bg-[oklch(0.22_0.02_260)] ${
        isDragging ? "shadow-lg ring-1 ring-[var(--color-active)]/40" : ""
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-0.5 opacity-30 group-hover:opacity-70 transition-opacity"
      >
        <GripVertical className="h-3 w-3" />
      </button>
      {word}
      <button
        onClick={onRemove}
        className="p-0.5 rounded-full hover:bg-[oklch(0.15_0.01_260)] opacity-50 group-hover:opacity-100 transition-opacity"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export default function VocabularyView({
  vocabulary,
  onVocabularyChange,
}: VocabularyViewProps) {
  const [newWord, setNewWord] = useState("");
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [detectedContext, setDetectedContext] = useState<DetectedContext | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = vocabulary.indexOf(active.id as string);
    const newIndex = vocabulary.indexOf(over.id as string);
    const reordered = arrayMove(vocabulary, oldIndex, newIndex);

    onVocabularyChange(reordered);
    await invoke("set_vocabulary", { words: reordered });
  };

  const fetchContext = async () => {
    try {
      const context = await invoke<DetectedContext>("get_detected_context");
      setDetectedContext(context);
    } catch (error) {
      console.error("Failed to fetch context:", error);
    }
  };

  // Fetch context on mount and listen for context updates
  useEffect(() => {
    fetchContext();

    // Listen for context updates from backend (emitted during recording)
    let unlisten: (() => void) | undefined;

    import("@tauri-apps/api/event").then(({ listen }) => {
      listen<DetectedContext>("context-updated", (event) => {
        setDetectedContext(event.payload);
      }).then((fn) => {
        unlisten = fn;
      });
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const addWord = async () => {
    const words = newWord
      .split(/[,\s]+/)
      .map((w) => w.trim())
      .filter((w) => w && !vocabulary.includes(w));

    if (words.length > 0) {
      const newVocabulary = [...vocabulary, ...words];
      await invoke("set_vocabulary", { words: newVocabulary });
      onVocabularyChange(newVocabulary);
      setNewWord("");
    }
  };

  const removeWord = async (word: string) => {
    await invoke("remove_vocabulary_word", { word });
    onVocabularyChange(vocabulary.filter((w) => w !== word));
  };

  const clearAll = async () => {
    await invoke("set_vocabulary", { words: [] });
    onVocabularyChange([]);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-[oklch(0.22_0.015_260)] shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Vocabulaire</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ajoutez vos termes personnalisés pour améliorer la transcription
          </p>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Auto-detection info with debug collapse */}
            <div className="rounded-xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 overflow-hidden">
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                    <Sparkles className="h-5 w-5 text-purple-400" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <h3 className="font-medium text-purple-200">Détection automatique du contexte</h3>
                    <p className="text-sm text-purple-300/70">
                      T4lk détecte automatiquement votre contexte de travail (VS Code, Zed, fenêtre active)
                      et adapte le vocabulaire technique pour une meilleure reconnaissance.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/20 text-xs text-purple-300">
                        <Code className="h-3.5 w-3.5" />
                        Langage détecté
                      </div>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/20 text-xs text-purple-300">
                        <Layers className="h-3.5 w-3.5" />
                        Frameworks
                      </div>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/20 text-xs text-purple-300">
                        <MonitorSmartphone className="h-3.5 w-3.5" />
                        Fenetre active
                      </div>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/20 text-xs text-purple-300">
                        <Hash className="h-3.5 w-3.5" />
                        Symboles
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Debug collapse header */}
              <button
                onClick={() => setIsDebugOpen(!isDebugOpen)}
                className="w-full flex items-center justify-between px-5 py-3 bg-purple-500/5 border-t border-purple-500/20 hover:bg-purple-500/10 transition-colors"
              >
                <span className="text-xs font-medium text-purple-300/80 flex items-center gap-2">
                  {isDebugOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  Contexte actuel
                </span>
              </button>

              {/* Debug content */}
              {isDebugOpen && (
                <div className="px-5 py-4 bg-[oklch(0.12_0.01_260)] border-t border-purple-500/10 space-y-4">
                  {detectedContext && detectedContext.has_real_context ? (
                    <>
                      {/* Context info grid */}
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="space-y-1">
                          <span className="text-purple-300/50 uppercase tracking-wider text-[10px]">Langage</span>
                          <div className="text-purple-200">
                            {detectedContext.language || <span className="text-purple-300/30 italic">Non détecté</span>}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <span className="text-purple-300/50 uppercase tracking-wider text-[10px]">Workspace</span>
                          <div className="text-purple-200">
                            {detectedContext.workspace || <span className="text-purple-300/30 italic">Non détecté</span>}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <span className="text-purple-300/50 uppercase tracking-wider text-[10px]">Domaine</span>
                          <div className="text-purple-200">
                            {detectedContext.domain || <span className="text-purple-300/30 italic">Non détecté</span>}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <span className="text-purple-300/50 uppercase tracking-wider text-[10px]">Fenetre</span>
                          <div className="text-purple-200 truncate" title={detectedContext.window_title || undefined}>
                            {detectedContext.window_title || <span className="text-purple-300/30 italic">Non détecté</span>}
                          </div>
                        </div>
                      </div>

                      {/* Frameworks */}
                      {detectedContext.frameworks.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-purple-300/50 uppercase tracking-wider text-[10px]">Frameworks détectés</span>
                          <div className="flex flex-wrap gap-1.5">
                            {detectedContext.frameworks.map((fw) => (
                              <span key={fw} className="px-2 py-0.5 rounded bg-purple-500/20 text-xs text-purple-300">
                                {fw}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Symbols */}
                      {detectedContext.symbols.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-purple-300/50 uppercase tracking-wider text-[10px]">
                            Symboles ({detectedContext.symbols.length})
                          </span>
                          <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                            {detectedContext.symbols.slice(0, 30).map((sym, i) => (
                              <span key={i} className="px-2 py-0.5 rounded bg-blue-500/20 text-xs text-blue-300 font-mono">
                                {sym}
                              </span>
                            ))}
                            {detectedContext.symbols.length > 30 && (
                              <span className="px-2 py-0.5 text-xs text-purple-300/50">
                                +{detectedContext.symbols.length - 30} autres
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Generated prompt */}
                      {detectedContext.vocabulary_prompt && (
                        <div className="space-y-2">
                          <span className="text-purple-300/50 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                            <FileText className="h-3 w-3" />
                            Prompt généré pour Whisper
                          </span>
                          <div className="p-3 rounded-lg bg-[oklch(0.10_0.01_260)] border border-purple-500/10">
                            <p className="text-xs text-purple-200/80 font-mono leading-relaxed break-words">
                              {detectedContext.vocabulary_prompt}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Available languages */}
                      <div className="space-y-2 pt-2 border-t border-purple-500/10">
                        <span className="text-purple-300/50 uppercase tracking-wider text-[10px]">
                          Langages supportés ({detectedContext.available_languages.length})
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {detectedContext.available_languages.map((lang) => (
                            <span
                              key={lang}
                              className={`px-1.5 py-0.5 rounded text-[10px] ${
                                lang === detectedContext.language
                                  ? "bg-green-500/30 text-green-300"
                                  : "bg-[oklch(0.18_0.01_260)] text-purple-300/50"
                              }`}
                            >
                              {lang}
                            </span>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-center py-4 text-purple-300/50 text-sm">
                        <Info className="h-5 w-5 mx-auto mb-2 opacity-50" />
                        <p>Aucune transcription effectuee</p>
                        <p className="text-xs mt-1 text-purple-300/30">
                          Utilisez le raccourci pour faire une transcription et voir le contexte détecté
                        </p>
                      </div>

                      {/* Still show available languages */}
                      {detectedContext && detectedContext.available_languages.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-purple-500/10">
                          <span className="text-purple-300/50 uppercase tracking-wider text-[10px]">
                            Langages supportés ({detectedContext.available_languages.length})
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {detectedContext.available_languages.map((lang) => (
                              <span
                                key={lang}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-[oklch(0.18_0.01_260)] text-purple-300/50"
                              >
                                {lang}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Add words input */}
            <div className="p-5 rounded-xl border border-[oklch(0.25_0.015_260)] bg-[oklch(0.15_0.01_260)] space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                <Plus className="h-4 w-4" />
                Mots personnalisés
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium">Ajouter des termes spécifiques</label>
                <p className="text-xs text-muted-foreground">
                  Ajoutez des noms propres, acronymes ou termes métier que la détection automatique ne couvre pas.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addWord())}
                    placeholder="Ex: MonProjet, ACME Corp..."
                    className="flex-1 px-3 py-2.5 text-sm rounded-lg border border-[oklch(0.25_0.015_260)] bg-[oklch(0.12_0.01_260)] focus:outline-none focus:ring-2 focus:ring-[var(--color-active)]/30 focus:border-[var(--color-active)]"
                  />
                  <Button
                    onClick={addWord}
                    disabled={!newWord.trim()}
                    className="bg-[var(--color-active)] text-[oklch(0.13_0.01_260)] hover:bg-[var(--color-active)]/90"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Ajouter
                  </Button>
                </div>
              </div>
            </div>

            {/* Word list */}
            <div className="p-5 rounded-xl border border-[oklch(0.25_0.015_260)] bg-[oklch(0.15_0.01_260)] space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  Vos termes ({vocabulary.length})
                </label>
                {vocabulary.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-xs text-[var(--color-destructive)] hover:text-[var(--color-destructive)]/80 flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    Tout supprimer
                  </button>
                )}
              </div>

              {vocabulary.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground border border-dashed border-[oklch(0.25_0.015_260)] rounded-lg">
                  <BookText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Aucun terme personnalisé</p>
                  <p className="text-xs mt-1">La detection automatique s'occupe du reste</p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={vocabulary} strategy={rectSortingStrategy}>
                    <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto">
                      {vocabulary.map((word) => (
                        <SortableVocabularyItem
                          key={word}
                          word={word}
                          onRemove={() => removeWord(word)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>

            {/* Info box */}
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-start gap-3">
                <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <div className="text-xs text-blue-300/80">
                  <p className="font-medium mb-1 text-blue-300">Comment ça fonctionne ?</p>
                  <p>
                    Le vocabulaire est automatiquement enrichi selon le contexte détecté (langage de programmation,
                    fichier ouvert, fenêtre active). Vos termes personnalisés sont combinés avec ce vocabulaire
                    automatique pour optimiser la transcription.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
