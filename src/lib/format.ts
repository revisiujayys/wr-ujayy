export function rupiah(n: number): string {
  return 'Rp' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// '10:00:00' -> '10.00'
export function formatTime(t: string): string {
  return t.slice(0, 5).replace(':', '.');
}
