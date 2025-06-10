export class AudioNotificationService {
  private static audioContext: AudioContext | null = null;
  private static hasPlayedScreenShareSound = false;

  private static async getAudioContext(): Promise<AudioContext> {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    // Resume context if suspended (required by some browsers)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    
    return this.audioContext;
  }

  static async playScreenShareStartSound(): Promise<void> {
    try {
      const audioContext = await this.getAudioContext();
      
      // Create a pleasant notification sound for screen sharing
      const oscillator1 = audioContext.createOscillator();
      const oscillator2 = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      // Create a chord (C + E)
      oscillator1.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
      oscillator2.frequency.setValueAtTime(659.25, audioContext.currentTime); // E5
      
      oscillator1.type = 'sine';
      oscillator2.type = 'sine';
      
      oscillator1.connect(gainNode);
      oscillator2.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Smooth volume envelope
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);
      
      oscillator1.start(audioContext.currentTime);
      oscillator2.start(audioContext.currentTime);
      oscillator1.stop(audioContext.currentTime + 0.8);
      oscillator2.stop(audioContext.currentTime + 0.8);
      
      // Screen share start notification played
    } catch (error) {
      // Could not play screen share notification
    }
  }

  static async playScreenShareStopSound(): Promise<void> {
    try {
      const audioContext = await this.getAudioContext();
      
      // Create a gentle "goodbye" sound for screen sharing end
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Descending tone
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
      oscillator.frequency.exponentialRampToValueAtTime(392.00, audioContext.currentTime + 0.5); // G4
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.6);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.6);
      
      // Screen share stop notification played
    } catch (error) {
      // Could not play screen share stop notification
    }
  }

  static async playFirstTimeScreenShareSound(): Promise<void> {
    if (this.hasPlayedScreenShareSound) {
      // Just play the regular start sound for subsequent shares
      return this.playScreenShareStartSound();
    }

    try {
      const audioContext = await this.getAudioContext();
      
      // Create a special "welcome to screen sharing" sound sequence
      const playTone = (frequency: number, startTime: number, duration: number, volume: number = 0.1) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, startTime);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };

      const now = audioContext.currentTime;
      
      // Play a pleasant ascending sequence (C-E-G-C)
      playTone(523.25, now, 0.3, 0.08);        // C5
      playTone(659.25, now + 0.15, 0.3, 0.08); // E5
      playTone(783.99, now + 0.3, 0.3, 0.08);  // G5
      playTone(1046.5, now + 0.45, 0.5, 0.1);  // C6
      
      this.hasPlayedScreenShareSound = true;
      // First-time screen share welcome sound played
    } catch (error) {
      // Could not play first-time screen share sound
      // Fallback to regular sound
      this.playScreenShareStartSound();
    }
  }

  static resetFirstTimeFlag(): void {
    this.hasPlayedScreenShareSound = false;
  }

  // Utility method to test if audio can be played
  static async testAudio(): Promise<boolean> {
    try {
      const audioContext = await this.getAudioContext();
      return audioContext.state === 'running';
    } catch (error) {
      return false;
    }
  }
}