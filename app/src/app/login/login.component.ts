import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../supabase.service';

import { LIMITE_CORREO, MIN_PASSWORD, MAX_PASSWORD } from '../auth-validation';

const ERROR_ACCESO = 'No fue posible iniciar sesión. Verifica tus datos e inténtalo de nuevo.';
const ERROR_REGISTRO = 'No fue posible completar el registro. Revisa tus datos o inténtalo más tarde.';
const sinEspacios: ValidatorFn = control => typeof control.value === 'string' && !control.value.trim() ? { required: true } : null;

const LIMITE_NOMBRE = 100;

// Acepta teléfonos de 10 dígitos (formato MX), con o sin +52/52 de código de país.
function telefonoValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const digitos = (control.value ?? '').replace(/\D/g, '');
    const valido = digitos.length === 10 || (digitos.length === 12 && digitos.startsWith('52'));
    return valido ? null : { telefonoInvalido: true };
  };
}

type Modo = 'login' | 'registro';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly limiteNombre = LIMITE_NOMBRE;
  readonly limiteCorreo = LIMITE_CORREO;
  readonly minimoPassword = MIN_PASSWORD;
  readonly maximoPassword = MAX_PASSWORD;

  // signal() porque esta app corre sin zone.js: los cambios después del await
  // no actualizarían la pantalla con propiedades normales.
  modo = signal<Modo>('login');
  enviando = signal(false);
  errorMensaje = signal<string | null>(null);
  mensajeExito = signal<string | null>(null);
  revisarCorreo = signal(false);
  mostrarPasswordLogin = signal(false);
  mostrarPasswordSignup = signal(false);

  loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, sinEspacios, Validators.email, Validators.maxLength(LIMITE_CORREO)]],
    password: ['', [Validators.required, sinEspacios, Validators.minLength(MIN_PASSWORD), Validators.maxLength(MAX_PASSWORD)]],
  });

  signupForm = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, sinEspacios, Validators.maxLength(LIMITE_NOMBRE)]],
    apellidos: ['', [Validators.required, sinEspacios, Validators.maxLength(LIMITE_NOMBRE)]],
    email: ['', [Validators.required, sinEspacios, Validators.email, Validators.maxLength(LIMITE_CORREO)]],
    telefono: ['', [Validators.required, telefonoValidator()]],
    password: ['', [Validators.required, sinEspacios, Validators.minLength(MIN_PASSWORD), Validators.maxLength(MAX_PASSWORD)]],
    aceptaTerminos: [false, Validators.requiredTrue],
  });

  titulo(): string {
    return this.modo() === 'login' ? 'Iniciar sesión' : 'Registrarse';
  }

  cambiarModo(modo: Modo) {
    this.modo.set(modo);
    this.errorMensaje.set(null);
    this.mensajeExito.set(null);
    this.revisarCorreo.set(false);
    this.loginForm.controls.password.reset('');
    this.signupForm.controls.password.reset('');
    this.mostrarPasswordLogin.set(false);
    this.mostrarPasswordSignup.set(false);
  }

  get loginEmailInvalido(): boolean {
    return this.invalidoYTocado(this.loginForm.controls.email);
  }

  get loginPasswordInvalido(): boolean {
    return this.invalidoYTocado(this.loginForm.controls.password);
  }

  get loginEmailMensaje(): string {
    return this.mensajeEmail(this.loginForm.controls.email);
  }

  get loginPasswordMensaje(): string {
    return this.mensajePassword(this.loginForm.controls.password);
  }

  get signupNombreInvalido(): boolean {
    return this.invalidoYTocado(this.signupForm.controls.nombre);
  }

  get signupApellidosInvalido(): boolean {
    return this.invalidoYTocado(this.signupForm.controls.apellidos);
  }

  get signupEmailInvalido(): boolean {
    return this.invalidoYTocado(this.signupForm.controls.email);
  }

  get signupTelefonoInvalido(): boolean {
    return this.invalidoYTocado(this.signupForm.controls.telefono);
  }

  get signupPasswordInvalido(): boolean {
    return this.invalidoYTocado(this.signupForm.controls.password);
  }

  get signupTerminosInvalido(): boolean {
    return this.invalidoYTocado(this.signupForm.controls.aceptaTerminos);
  }

  get signupNombreMensaje(): string {
    return this.signupForm.controls.nombre.errors?.['required']
      ? 'Este campo es obligatorio'
      : `Máximo ${LIMITE_NOMBRE} caracteres`;
  }

  get signupApellidosMensaje(): string {
    return this.signupForm.controls.apellidos.errors?.['required']
      ? 'Este campo es obligatorio'
      : `Máximo ${LIMITE_NOMBRE} caracteres`;
  }

  get signupEmailMensaje(): string {
    return this.mensajeEmail(this.signupForm.controls.email);
  }

  get signupTelefonoMensaje(): string {
    return this.signupForm.controls.telefono.errors?.['required']
      ? 'Este campo es obligatorio'
      : 'Ingresa un teléfono válido a 10 dígitos';
  }

  get signupPasswordMensaje(): string {
    return this.mensajePassword(this.signupForm.controls.password);
  }

  async login() {
    if (this.enviando()) return;
    this.errorMensaje.set(null); this.mensajeExito.set(null);
    const correo = this.loginForm.controls.email.value;
    // Solo se recorta el correo válido en longitud; la contraseña se envía intacta.
    if (correo.length <= LIMITE_CORREO) this.loginForm.controls.email.setValue(correo.trim());
    if (this.loginForm.invalid) { this.loginForm.markAllAsTouched(); return; }
    const { email, password } = this.loginForm.getRawValue();
    this.enviando.set(true);
    try {
      const { error } = await this.supabase.signIn(email, password);
      if (error) { this.errorMensaje.set(ERROR_ACCESO); return; }
      const chatViaje = this.route.snapshot.queryParamMap.get('chatViaje');
      if (chatViaje && /^[1-9]\d*$/.test(chatViaje)) { await this.router.navigate(['/chat', chatViaje]); return; }
      const destino = this.route.snapshot.queryParamMap.get('destinoReserva');
      await this.router.navigate(destino ? ['/reservar'] : ['/'], {
        queryParams: destino ? { destino } : undefined,
        state: { accesoCorrecto: true },
      });
    } catch { this.errorMensaje.set(ERROR_ACCESO); }
    finally {
      this.loginForm.controls.password.reset('');
      this.mostrarPasswordLogin.set(false);
      this.enviando.set(false);
    }
  }

  async registrar() {
    if (this.enviando()) return;
    this.errorMensaje.set(null); this.mensajeExito.set(null);
    if (this.signupForm.invalid) { this.signupForm.markAllAsTouched(); return; }
    const { nombre, apellidos, email, telefono, password } = this.signupForm.getRawValue();
    this.enviando.set(true);
    try {
      const { data, error } = await this.supabase.signUp(email.trim(), password, { nombre: nombre.trim(), apellidos: apellidos.trim(), telefono });
      if (error) { this.errorMensaje.set(ERROR_REGISTRO); return; }
      if (!data.session) { this.revisarCorreo.set(true); return; }
      await this.supabase.signOut();
      this.signupForm.reset();
      this.loginForm.patchValue({ email: email.trim() });
      this.mensajeExito.set('Solicitud de registro procesada. Inicia sesión o revisa tu correo para continuar.');
      this.modo.set('login');
    } catch { this.errorMensaje.set(ERROR_REGISTRO); }
    finally {
      this.signupForm.controls.password.reset('');
      this.mostrarPasswordSignup.set(false);
      this.enviando.set(false);
    }
  }

  private mensajePassword(control: AbstractControl): string {
    if (control.errors?.['required']) return 'Este campo es obligatorio';
    if (control.errors?.['maxlength']) return `Máximo ${MAX_PASSWORD} caracteres`;
    return `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`;
  }

  private invalidoYTocado(control: AbstractControl): boolean {
    return control.invalid && (control.dirty || control.touched);
  }

  private mensajeEmail(control: AbstractControl): string {
    if (control.errors?.['required']) return 'Este campo es obligatorio';
    if (control.errors?.['maxlength']) return `Máximo ${LIMITE_CORREO} caracteres`;
    return 'Ingresa un correo válido';
  }
}
