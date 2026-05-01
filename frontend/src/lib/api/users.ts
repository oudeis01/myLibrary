import { api } from './client';

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'member' | 'guest';
  created_at: string;
}

export interface LibraryMember {
  user_id: string;
  username: string;
  can_read: boolean;
  can_upload: boolean;
}

export async function getUsers(): Promise<User[]> {
  return api.get('users').json();
}

export async function getMe(): Promise<User> {
  return api.get('users/me').json();
}

export async function createUser(username: string, password: string, role = 'member'): Promise<User> {
  return api.post('users', { json: { username, password, role } }).json();
}

export async function updateUser(id: string, data: { role?: string; password?: string }): Promise<User> {
  return api.patch(`users/${id}`, { json: data }).json();
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`users/${id}`);
}

export async function getLibraryMembers(libraryId: string): Promise<LibraryMember[]> {
  return api.get(`libraries/${libraryId}/members`).json();
}

export async function addLibraryMember(
  libraryId: string,
  userId: string,
  canRead = true,
  canUpload = false,
): Promise<LibraryMember> {
  return api
    .post(`libraries/${libraryId}/members`, {
      json: { user_id: userId, can_read: canRead, can_upload: canUpload },
    })
    .json();
}

export async function updateLibraryMember(
  libraryId: string,
  userId: string,
  data: { can_read?: boolean; can_upload?: boolean },
): Promise<LibraryMember> {
  return api.patch(`libraries/${libraryId}/members/${userId}`, { json: data }).json();
}

export async function removeLibraryMember(libraryId: string, userId: string): Promise<void> {
  await api.delete(`libraries/${libraryId}/members/${userId}`);
}
