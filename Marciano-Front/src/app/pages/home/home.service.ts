import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';

export type RoomStatus = 'idle' | 'running' | 'finished';

export interface Participant {
  id: string;
  name: string;
  envelope: string;
}

export interface Room {
  code: string;
  title: string;
  isAnonymous: boolean;
  status: RoomStatus;
  participants: Participant[];
}

function uid() { return Math.random().toString(36).slice(2, 9); }
function genCode() {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 6 }, () => A[Math.floor(Math.random() * A.length)]).join('');
}

@Injectable({ providedIn: 'root' })
export class HomeService {
  
}
