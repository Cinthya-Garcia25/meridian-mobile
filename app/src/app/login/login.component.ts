import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../supabase.service';

// Mismos mensajes y reglas que la app web (meridian-travel/frontend/src/app/core/services/auth.service.ts
// y core/validation.ts).
const ERRORES: Record<string, string> = {
  'Invalid login credentials': 'Correo o contraseña incorrectos.',
  'User already registered': 'Ya existe una cuenta con ese correo.',
  'Email not confirmed': 'Confirma tu correo antes de iniciar sesión (revisa tu bandeja de entrada).',
  'Password should be at least 6 characters.': 'La contraseña debe tener al menos 6 caracteres.',
  'email rate limit exceeded': 'Se enviaron demasiados correos en poco tiempo. Espera unos minutos e intenta de nuevo.',
};

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

  readonly limiteNombre = LIMITE_NOMBRE;

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
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  signupForm = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(LIMITE_NOMBRE)]],
    apellidos: ['', [Validators.required, Validators.maxLength(LIMITE_NOMBRE)]],
    email: ['', [Validators.required, Validators.email]],
    telefono: ['', [Validators.required, telefonoValidator()]],
    password: ['', [Validators.required, Validators.minLength(6)]],
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
    return 'Este campo es obligatorio';
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
    return this.signupForm.controls.password.errors?.['required']
      ? 'Este campo es obligatorio'
      : 'Debe tener al menos 6 caracteres';
  }

  async login() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    const { email, password } = this.loginForm.getRawValue();
    this.errorMensaje.set(null);
    this.mensajeExito.set(null);
    this.enviando.set(true);

    const { error } = await this.supabase.signIn(email, password);
    this.enviando.set(false);

    if (error) {
      this.errorMensaje.set(ERRORES[error.message] ?? error.message);
      return;
    }
    this.router.navigate(['/']);
  }

  async registrar() {
    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();
      return;
    }
    const { nombre, apellidos, email, telefono, password } = this.signupForm.getRawValue();
    this.errorMensaje.set(null);
    this.enviando.set(true);

    const { data, error } = await this.supabase.signUp(email, password, { nombre, apellidos, telefono });

    if (error) {
      this.enviando.set(false);
      this.errorMensaje.set(ERRORES[error.message] ?? error.message);
      return;
    }

    // El proyecto tiene "Confirm email" activado: no hay sesión hasta que el usuario confirme.
    if (!data.session) {
      this.enviando.set(false);
      this.revisarCorreo.set(true);
      return;
    }

    // Igual que la web: no se entra directo, se cierra la sesión que deja el registro
    // y se manda al login con el correo precargado.
    await this.supabase.signOut();
    this.enviando.set(false);
    this.signupForm.reset();
    this.loginForm.patchValue({ email });
    this.mensajeExito.set('Tu cuenta se creó correctamente. Inicia sesión para continuar.');
    this.modo.set('login');
  }

  private invalidoYTocado(control: AbstractControl): boolean {
    return control.invalid && (control.dirty || control.touched);
  }

  private mensajeEmail(control: AbstractControl): string {
    return control.errors?.['required'] ? 'Este campo es obligatorio' : 'Ingresa un correo válido';
  }
}
