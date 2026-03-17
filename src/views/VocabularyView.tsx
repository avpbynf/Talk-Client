import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  BookText,
  Plus,
  X,
  Trash2,
  Info,
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
      className={`inline-flex items-center gap-1 px-3 py-1.5 bg-surface-active rounded-full text-sm group transition-colors hover:bg-secondary ${
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
        className="p-0.5 rounded-full hover:bg-surface-raised opacity-50 group-hover:opacity-100 transition-opacity"
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
      <div className="px-6 py-5 border-b border-border-subtle shrink-0">
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
            {/* Add words input */}
            <div className="p-5 rounded-xl border border-border-card bg-surface-raised space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                <Plus className="h-4 w-4" />
                Mots personnalisés
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium">Ajouter des termes spécifiques</label>
                <p className="text-xs text-muted-foreground">
                  Ajoutez des noms propres, acronymes ou termes métier pour améliorer la reconnaissance.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addWord())}
                    placeholder="Ex: MonProjet, ACME Corp..."
                    className="flex-1 px-3 py-2.5 text-sm rounded-lg border border-border-card bg-surface-inset focus:outline-none focus:ring-2 focus:ring-[var(--color-active)]/30 focus:border-[var(--color-active)]"
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
            <div className="p-5 rounded-xl border border-border-card bg-surface-raised space-y-3">
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
                <div className="py-8 text-center text-muted-foreground border border-dashed border-border-card rounded-lg">
                  <BookText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Aucun terme personnalisé</p>
                  <p className="text-xs mt-1">Les termes par défaut T4lk sont déjà pré-chargés</p>
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
            <div className="p-4 rounded-xl bg-[var(--color-server)]/10 border border-[var(--color-server)]/20">
              <div className="flex items-start gap-3">
                <Info className="h-4 w-4 text-server mt-0.5 shrink-0" />
                <div className="text-xs text-[var(--color-server)]/80">
                  <p className="font-medium mb-1 text-server">Comment ça fonctionne ?</p>
                  <p>
                    Les mots de vocabulaire sont transmis directement à Whisper comme indices pour améliorer
                    la reconnaissance. Ajoutez vos noms propres, acronymes et termes métier pour de meilleurs résultats.
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
