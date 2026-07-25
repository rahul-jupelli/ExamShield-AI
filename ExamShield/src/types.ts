export type StudentStatus = 'Device Detected' | 'Suspicious' | 'Verified Safe';

export interface Student {
  id: string;
  name: string;
  hallTicket: string;
  branch: string;
  room: string;
  seat: string;
  photo: string;
  status: StudentStatus;
  
  // Group 1 Specific
  detectedDevice?: string;
  detectionConfidence?: number;
  
  // Group 2 Specific
  suspicionScore?: number;
  suspicionReason?: string;
  snapshot?: string;
  
  // Group 3 Specific
  verificationCompleted?: boolean;
  entryAllowed?: boolean;
  
  timestamp: string;
  faceConfidence?: number;
  entryDecision?: 'Allowed' | 'Denied' | 'Pending';
  verificationHistory?: string[];
  violationHistory?: string[];
}

export type AlertPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type AlertStatus = 'Active' | 'Investigating' | 'Resolved';

export interface LiveAlert {
  id: string;
  title: string;
  priority: AlertPriority;
  timestamp: string;
  location: string;
  actionTaken: string;
  status: AlertStatus;
  snapshot?: string;
  details?: string;
}

export interface RoverStatus {
  battery: number;
  speed: number;
  location: string;
  hall: string;
  floor: number;
  wifiStatus: 'Excellent' | 'Good' | 'Poor' | 'Disconnected';
  cameraStatus: 'Online' | 'Offline' | 'Lagging';
  temperature: number;
  cpuUsage: number;
  storageUsed: number; // in GB
  storageTotal: number; // in GB
  motorStatus: 'Operational' | 'Warning' | 'Error' | 'Stopped';
  currentMission: string;
  estimatedTimeRemaining: number; // in minutes
  posX: number; // Map percentage X (0-100)
  posY: number; // Map percentage Y (0-100)
  manualMode: boolean;
}

export interface SystemMetrics {
  backend: 'online' | 'offline';
  aiModel: 'online' | 'offline';
  camera: 'online' | 'offline';
  database: 'online' | 'offline';
  storage: number; // percent
  internet: 'connected' | 'disconnected';
  roverConnection: 'connected' | 'disconnected';
  modelFps: number;
  inferenceTime: number; // ms
  cpu: number; // percent
  memory: number; // percent
  gpu: number; // percent
}

export interface AIDetectionLog {
  id: string;
  frameUrl: string;
  detectedObjects: string[];
  confidence: number;
  decision: string;
  operator: string;
  timestamp: string;
  hall: string;
}

export type UserRole = 'Admin' | 'Exam Controller' | 'Operator' | 'Viewer';

export interface UserSession {
  username: string;
  role: UserRole;
  fullName: string;
  token?: string;
}
