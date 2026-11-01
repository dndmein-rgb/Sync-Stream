/** Estimates (server time − client time) using the lowest-RTT recent sample. */
class ServerClock {
  private offset = 0;
  private samples: { rtt: number; offset: number }[] = [];

  now(): number {
    return Date.now() + this.offset;
  }

  addSample(clientSent: number, serverTime: number) {
    const received = Date.now();
    const rtt = received - clientSent;
    if (rtt < 0) return;
    this.samples.push({ rtt, offset: serverTime + rtt / 2 - received });
    if (this.samples.length > 8) this.samples.shift();
    this.offset = this.samples.reduce((a, b) => (b.rtt < a.rtt ? b : a)).offset;
  }
}

export const serverClock = new ServerClock();