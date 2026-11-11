import { TestBed } from '@angular/core/testing';
import { App } from './app.component';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Desvende o ISO 8583');
  });

  it('should present parser labels and errors in Brazilian Portuguese', () => {
    const app = TestBed.createComponent(App).componentInstance;

    expect(app.displayError('Invalid characters detected. Only hex characters (0-9, A-F) are allowed.'))
      .toBe('Foram encontrados caracteres inválidos. Use apenas caracteres hexadecimais (0–9, A–F).');
    expect(app.displaySegmentLabel('Primary Bitmap')).toBe('Mapa de bits primário');
    expect(app.mtiPartLabel('Unknown')).toBe('Desconhecido');
  });
});
