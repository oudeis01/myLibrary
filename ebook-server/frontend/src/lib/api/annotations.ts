import { api } from './client';

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
  return api.post(`books/${bookId}/annotations`, { json: data }).json();
}

export async function updateAnnotation(id: string, note: string): Promise<Annotation> {
  return api.patch(`annotations/${id}`, { json: { note } }).json();
}

export async function deleteAnnotation(id: string): Promise<void> {
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
