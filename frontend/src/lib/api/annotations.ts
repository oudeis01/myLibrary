import { api } from './client';
import { queuePendingWrite } from '$lib/offline/db';

export interface Annotation {
  id: string;
  book_id: string;
  user_id: string;
  kind: 'highlight' | 'note';
  color: string | null;
  page: number | null;
  cfi_range: string | null;
  position: PdfPosition | null;
  text_content: string | null;
  note: string | null;
  created_at: string;
}

export interface PdfPosition {
  rects: Array<{ x: number; y: number; width: number; height: number }>;
}

export interface CreateAnnotation {
  kind: 'highlight' | 'note';
  color?: string;
  page?: number;
  cfi_range?: string;
  position?: PdfPosition;
  text_content?: string;
  note?: string;
}

export async function getAnnotations(bookId: string): Promise<Annotation[]> {
  return api.get(`books/${bookId}/annotations`).json();
}

export async function createAnnotation(bookId: string, data: CreateAnnotation): Promise<Annotation> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await queuePendingWrite({ method: 'POST', endpoint: `books/${bookId}/annotations`, body: data });
    return {
      id: `pending-${Date.now()}`,
      book_id: bookId,
      user_id: '',
      kind: data.kind,
      color: data.color ?? null,
      page: data.page ?? null,
      cfi_range: data.cfi_range ?? null,
      position: data.position ?? null,
      text_content: data.text_content ?? null,
      note: data.note ?? null,
      created_at: new Date().toISOString(),
    };
  }
  return api.post(`books/${bookId}/annotations`, { json: data }).json();
}

export async function updateAnnotation(id: string, note: string): Promise<Annotation> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await queuePendingWrite({ method: 'PATCH', endpoint: `annotations/${id}`, body: { note } });
    return { id } as Annotation;
  }
  return api.patch(`annotations/${id}`, { json: { note } }).json();
}

export async function deleteAnnotation(id: string): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await queuePendingWrite({ method: 'DELETE', endpoint: `annotations/${id}` });
    return;
  }
  await api.delete(`annotations/${id}`);
}

export async function exportAnnotations(bookId: string, format: 'json' | 'md'): Promise<void> {
  const resp = await api.get(`books/${bookId}/annotations/export`, { searchParams: { format } });
  const blob = await resp.blob();
  const ext = format === 'md' ? 'md' : 'json';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `annotations.${ext}`;
  a.click();
  URL.revokeObjectURL(a.href);
}
