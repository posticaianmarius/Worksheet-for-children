export type Id = number | string;
export type Role = "USER" | "TEACHER" | "ADMIN";
export interface User {
  id: number;
  name: string;
  email?: string;
  role: Role;
}
export interface Animal {
  id: string;
  name: string;
  img: string;
  imageAssetId?: number | null;
}
export interface Pair {
  id: string;
  number: number;
  emoji: string;
  imageAssetId?: number | null;
}
export interface Configuration {
  maxNumber?: number;
  exerciseCount?: number;
  operations?: string[];
  letter?: string;
  animals?: Animal[];
  pairs?: Pair[];
  imageAssetId?: number | null;
  [key: string]: unknown;
}
export interface ImageSlot {
  key?: string;
  path?: string;
  label?: string;
  allowUpload?: boolean;
  acceptedContentTypes?: string[];
  maxUploadBytes?: number;
  variants?: { assetId: number; url: string; filename: string }[];
}
export interface Schema {
  type?: string | string[];
  properties?: Record<string, Schema>;
  required?: string[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  enum?: unknown[];
  items?: Schema;
  default?: unknown;
  "x-image-slots"?: Record<string, ImageSlot>;
  [key: string]: unknown;
}
export interface Definition {
  id: number;
  type: string;
  version: number;
  name?: string;
  active?: boolean;
  configurationSchema?: Schema;
  resultSchema?: Schema;
  defaultConfiguration?: Configuration;
}
export interface WorksheetItem {
  id: number;
  miniGameId: number;
  orderIndex: number;
  configuration: Configuration;
  definition?: Definition;
}
export interface DraftItem {
  key: string;
  id?: number;
  miniGameId: number;
  orderIndex: number;
  configuration: Configuration;
  definition?: Definition;
}
export interface Worksheet {
  id: number;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  items: WorksheetItem[];
}
export interface Classroom {
  id: number;
  name: string;
  teacherName?: string;
  joinCode?: string;
}
export interface Member {
  userId: number;
  name: string;
  email?: string;
  studentCode?: string;
  accessCode?: string;
  code?: string;
  lastTestPercent?: number | null;
  averagePercent?: number | null;
  worstTest?: string | null;
  teacherManaged?: boolean;
}
export interface Assignment {
  id: number;
  userId: number;
  userName?: string;
  teacherName?: string;
  classroomId?: number;
  worksheet: Worksheet;
  status: string;
  revokedAt?: string | null;
}
export interface GameResult {
  outcome: "COMPLETED" | "SKIPPED";
  score: number;
  maxScore: number;
  timeSeconds: number;
  details: Record<string, unknown>;
}
export interface ItemResult extends GameResult {
  revisionItemId: number;
}
export interface Attempt {
  id: number;
  assignmentId?: number;
  worksheetId: number;
  status: string;
  items: WorksheetItem[];
  results: ItemResult[];
  totalScore?: number;
  maxScore?: number;
  startedAt?: string;
  completedAt?: string;
}
export interface StudentTest {
  attemptId: number;
  name: string;
  status: string;
  totalScore?: number;
  maxScore?: number;
  completedAt?: string;
  startedAt?: string;
}
export interface ReportRow {
  assignmentId: number;
  classroomId: number | null;
  classroomName: string;
  worksheetId: number;
  revisionId: number;
  revisionNumber: number;
  worksheetName: string;
  worksheetCode?: string;
  codeStatus?: string;
  userId: number;
  userName: string;
  assignedAt: string;
  revokedAt?: string | null;
  removedAt?: string | null;
  status: string;
  attemptId?: number | null;
  totalScore?: number | null;
  maxScore?: number | null;
  completedAt?: string | null;
}
export interface Asset {
  id: number;
  url: string;
  originalFilename: string;
}
export interface AssetPage {
  items: Asset[];
  totalElements: number;
}
