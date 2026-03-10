import axios, { AxiosInstance } from 'axios';
import type {
  CCStudent,
  CCBehaviourPoint,
  CCHomework,
  CCAttendance,
  CCTimetableLesson,
  CCAnnouncement,
} from './types';

const BASE_URL = 'https://apiv2.classcharts.com/apiv2parent';

export class ClassChartsClient {
  private http: AxiosInstance;
  private sessionId: string | null = null;
  private studentId: number | null = null;

  constructor(private email: string, private code: string) {
    this.http = axios.create({ baseURL: BASE_URL });
  }

  async login(): Promise<CCStudent[]> {
    const res = await this.http.post('/login', {
      email: this.email,
      password: this.code,
      remember_me: 1,
    });
    this.sessionId = res.data.data?.session_id;
    this.http.defaults.headers.common['Authorization'] = `Basic ${this.sessionId}`;
    return res.data.data?.pupils ?? [];
  }

  async getStudents(): Promise<CCStudent[]> {
    const res = await this.http.get('/pupils');
    return res.data.data ?? [];
  }

  async getHomework(studentId: number, from: string, to: string): Promise<CCHomework[]> {
    const res = await this.http.get(`/homeworks/${studentId}`, {
      params: { display_date: 'due_date', from, to },
    });
    return res.data.data ?? [];
  }

  async getBehaviour(studentId: number, from: string, to: string): Promise<CCBehaviourPoint[]> {
    const res = await this.http.get(`/behaviour/${studentId}`, {
      params: { from, to },
    });
    return res.data.data?.timeline ?? [];
  }

  async getAttendance(studentId: number, from: string, to: string): Promise<CCAttendance[]> {
    const res = await this.http.get(`/attendance/${studentId}`, {
      params: { from, to },
    });
    return res.data.data ?? [];
  }

  async getTimetable(studentId: number, date: string): Promise<CCTimetableLesson[]> {
    const res = await this.http.get(`/timetable/${studentId}`, {
      params: { date },
    });
    return res.data.data ?? [];
  }

  async getAnnouncements(studentId: number): Promise<CCAnnouncement[]> {
    const res = await this.http.get(`/announcements/${studentId}`);
    return res.data.data ?? [];
  }
}
