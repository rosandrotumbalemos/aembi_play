"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Plus, FileVideo } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { MAX_AD_UPLOAD_SIZE_BYTES } from "@aembi-play/shared";

type Option = { id: string; name: string };

const MAX_SIZE_MB = Math.round(MAX_AD_UPLOAD_SIZE_BYTES / (1024 * 1024));

function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(Number.isFinite(video.duration) ? video.duration : 0);
    };
    video.onerror = () => resolve(0);
    video.src = URL.createObjectURL(file);
  });
}

function uploadWithProgress(
  formData: FormData,
  onProgress: (percent: number) => void,
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/ads/upload");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ ok: true });
        return;
      }
      try {
        const body = JSON.parse(xhr.responseText);
        resolve({ ok: false, error: body.error ?? "Falha no upload." });
      } catch {
        resolve({ ok: false, error: "Falha no upload." });
      }
    };
    xhr.onerror = () => resolve({ ok: false, error: "Falha de rede durante o upload." });
    xhr.send(formData);
  });
}

export function NewAdDialog({
  advertisers,
  categories,
}: {
  advertisers: Option[];
  categories: Option[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetState() {
    setFile(null);
    setTitle("");
    setProgress(null);
    setError(undefined);
  }

  function handleFileSelected(selected: File | null) {
    if (!selected) return;
    if (selected.type !== "video/mp4") {
      setError(`Formato não suportado (${selected.type || "desconhecido"}). Envie um MP4.`);
      return;
    }
    if (selected.size > MAX_AD_UPLOAD_SIZE_BYTES) {
      setError(`Arquivo excede o limite de ${MAX_SIZE_MB} MB.`);
      return;
    }
    setError(undefined);
    setFile(selected);
    if (!title) {
      setTitle(selected.name.replace(/\.mp4$/i, ""));
    }
  }

  async function handleSubmit(formData: FormData) {
    if (!file) {
      setError("Selecione um vídeo MP4.");
      return;
    }
    setError(undefined);
    setProgress(0);

    const durationSeconds = await readVideoDuration(file);
    formData.set("file", file);
    formData.set("durationSeconds", String(durationSeconds));

    const result = await uploadWithProgress(formData, setProgress);
    if (!result.ok) {
      setError(result.error);
      setProgress(null);
      return;
    }

    setOpen(false);
    resetState();
    router.refresh();
  }

  const isUploading = progress !== null && progress < 100 ? true : progress === 100;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetState();
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <Plus />
            Novo anúncio
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo anúncio</DialogTitle>
          <DialogDescription>
            MP4 (H.264/AAC), até {MAX_SIZE_MB} MB. Depois do envio, o worker valida o
            arquivo e publica automaticamente.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="grid gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4"
            className="hidden"
            onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFileSelected(e.dataTransfer.files?.[0] ?? null);
            }}
            className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            {file ? (
              <>
                <FileVideo className="size-6 text-muted-foreground" />
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / (1024 * 1024)).toFixed(1)} MB
                </p>
              </>
            ) : (
              <>
                <UploadCloud className="size-6 text-muted-foreground" />
                <p className="text-sm">Arraste o vídeo aqui ou clique para escolher</p>
                <p className="text-xs text-muted-foreground">MP4 · até {MAX_SIZE_MB} MB</p>
              </>
            )}
          </button>

          {progress !== null && (
            <Progress value={progress}>
              <span className="text-sm text-muted-foreground">
                {progress < 100 ? "Enviando..." : "Processando..."}
              </span>
            </Progress>
          )}

          <div className="grid gap-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              name="title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="advertiserId">Anunciante *</Label>
              <Select name="advertiserId" required disabled={advertisers.length === 0}>
                <SelectTrigger id="advertiserId" className="w-full">
                  <SelectValue
                    placeholder={
                      advertisers.length === 0 ? "Cadastre um anunciante primeiro" : "Selecione"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {advertisers.map((advertiser) => (
                    <SelectItem key={advertiser.id} value={advertiser.id}>
                      {advertiser.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="categoryId">Categoria</Label>
              <Select name="categoryId">
                <SelectTrigger id="categoryId" className="w-full">
                  <SelectValue placeholder="Sem categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" name="description" rows={2} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={isUploading || advertisers.length === 0}>
              {isUploading ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
