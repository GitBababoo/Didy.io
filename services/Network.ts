import Peer, { DataConnection } from 'peerjs';
import { PlayerInput } from '../types';

type NetworkCallback = (data: any) => void;
type ConnectionCallback = (id: string) => void;

export class NetworkService {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map(); // For Host: map of peerId -> connection
  private hostConnection: DataConnection | null = null; // For Client: connection to host
  
  private onDataCallbacks: NetworkCallback[] = [];
  private onConnectionCallbacks: ConnectionCallback[] = [];
  
  public myPeerId: string = '';
  public isHost: boolean = false;

  constructor() {
    // Lazy initialization in methods to ensure browser env
  }

  // --- HOST METHODS ---

  public async initializeHost(): Promise<string> {
    this.isHost = true;
    return new Promise((resolve, reject) => {
      // Create a short random ID for easier sharing (e.g. 6 chars)
      const shortId = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      this.peer = new Peer(shortId, {
        debug: 1
      });

      this.peer.on('open', (id) => {
        this.myPeerId = id;
        console.log('Host initialized with ID:', id);
        resolve(id);
      });

      this.peer.on('connection', (conn) => {
        console.log('Peer connected:', conn.peer);
        this.handleNewConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.error('Peer error:', err);
        reject(err);
      });
    });
  }

  private handleNewConnection(conn: DataConnection) {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      this.onConnectionCallbacks.forEach(cb => cb(conn.peer));
    });

    conn.on('data', (data) => {
      // As host, we receive inputs from clients
      // We pass this data to the engine with the sender's ID
      this.onDataCallbacks.forEach(cb => cb({ sender: conn.peer, data }));
    });

    conn.on('close', () => {
      console.log('Peer disconnected:', conn.peer);
      this.connections.delete(conn.peer);
      // Optional: notify engine to remove player
      this.onDataCallbacks.forEach(cb => cb({ type: 'DISCONNECT', sender: conn.peer }));
    });
  }

  public broadcast(data: any) {
    if (!this.isHost) return;
    this.connections.forEach(conn => {
      if (conn.open) conn.send(data);
    });
  }

  // --- CLIENT METHODS ---

  public async joinGame(hostId: string): Promise<void> {
    this.isHost = false;
    return new Promise((resolve, reject) => {
      this.peer = new Peer({ debug: 1 });

      this.peer.on('open', (id) => {
        this.myPeerId = id;
        console.log('Client initialized with ID:', id);
        
        const conn = this.peer!.connect(hostId, { reliable: true }); // Reliable for setup
        
        conn.on('open', () => {
          console.log('Connected to Host');
          this.hostConnection = conn;
          resolve();
        });

        conn.on('data', (data) => {
            this.onDataCallbacks.forEach(cb => cb(data));
        });

        conn.on('close', () => {
           console.log('Disconnected from Host');
           // Handle disconnection (alert user, etc.)
        });
        
        conn.on('error', (err) => {
            reject(err);
        });
      });

      this.peer.on('error', (err) => {
        reject(err);
      });
    });
  }

  public sendInput(input: PlayerInput) {
    if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send({ type: 'INPUT', input });
    }
  }

  public sendAction(action: { type: string, [key: string]: any }) {
    if (this.hostConnection && this.hostConnection.open) {
        this.hostConnection.send({ type: 'ACTION', action });
    }
  }

  // --- SHARED ---

  public onData(callback: NetworkCallback) {
    this.onDataCallbacks.push(callback);
  }

  public onPeerConnect(callback: ConnectionCallback) {
    this.onConnectionCallbacks.push(callback);
  }

  public close() {
    this.connections.forEach(c => c.close());
    this.hostConnection?.close();
    this.peer?.destroy();
    this.connections.clear();
    this.peer = null;
    this.hostConnection = null;
    this.onDataCallbacks = [];
    this.onConnectionCallbacks = [];
    this.isHost = false;
  }
}

export const network = new NetworkService();