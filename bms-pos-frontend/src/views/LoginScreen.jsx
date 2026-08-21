import React, { useState } from 'react';
import Swal from 'sweetalert2';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthService, SystemService } from '../api/services';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { tenantConfig } from '../config/tenantConfig';

export const LoginScreen = ({ onLoginSuccess }) => {
    // Estados del formulario
    const [credentials, setCredentials] = useState({ username: '', password: '' });
    const [forgotEmail, setForgotEmail] = useState(''); 
    const [resetData, setResetData] = useState({ code: '', newPassword: '' }); 
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Estados del Flujo de Pasos (LOGIN | SELECT_REGISTER | FORGOT_PASSWORD | RESET_PASSWORD)
    const [step, setStep] = useState('LOGIN'); 
    const [registers, setRegisters] = useState([]);
    const [loggedUser, setLoggedUser] = useState(null);

    // 🎨 VARIANTE DE ANIMACIÓN PARA CAMBIO DE PANTALLAS
    const pageTransition = {
        initial: { opacity: 0, y: 20, filter: 'blur(10px)' },
        animate: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { type: 'spring', stiffness: 300, damping: 25 } },
        exit: { opacity: 0, y: -20, filter: 'blur(10px)', transition: { duration: 0.2 } }
    };

    // 🛡️ PASO 1: Validar credenciales
    const handleLogin = async (e) => {
        e.preventDefault();
        
        if (!credentials.username || !credentials.password) {
            return Swal.fire({ 
                icon: 'warning', 
                title: 'Atención', 
                text: 'Por favor ingrese usuario y contraseña.', 
                confirmButtonColor: '#2563eb',
                customClass: { popup: 'rounded-3xl' }
            });
        }

        setIsLoading(true);
        try {
            const response = await AuthService.login(credentials);
            
            if (response.data && response.data.success) {
                const user = response.data.user;
                const token = response.data.token;
                
                localStorage.setItem('bms_token', token);
                localStorage.setItem('bms_user', JSON.stringify(user));
                
                setLoggedUser(user);

                const regRes = await SystemService.getRegisters();
                setRegisters(regRes.data || []);
                
                setStep('SELECT_REGISTER');
            }
        } catch (error) {
            const errorMsg = error.response?.data?.error || 'No se pudo conectar con el servidor.';
            Swal.fire({ 
                icon: 'error', 
                title: 'Acceso Denegado', 
                text: errorMsg, 
                confirmButtonColor: '#2563eb',
                customClass: { popup: 'rounded-3xl' }
            });
        } finally {
            setIsLoading(false);
        }
    };

    // 🛡️ PASO 2: Solicitar Código OTP
    const handleForgotPasswordSubmit = async (e) => {
        e.preventDefault();
        if (!forgotEmail) {
            return Swal.fire({ icon: 'warning', title: 'Atención', text: 'Por favor ingrese su correo electrónico.', confirmButtonColor: '#2563eb', customClass: { popup: 'rounded-3xl' } });
        }

        setIsLoading(true);
        try {
            await AuthService.forgotPassword({ email: forgotEmail });
            
            Swal.fire({
                icon: 'success',
                title: 'Solicitud Enviada',
                text: 'Si el correo está registrado, recibirá un código de restauración pronto.',
                confirmButtonColor: '#2563eb',
                customClass: { popup: 'rounded-3xl' }
            });
            
            setStep('RESET_PASSWORD');
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error || 'No se pudo procesar la solicitud.', confirmButtonColor: '#2563eb', customClass: { popup: 'rounded-3xl' } });
        } finally {
            setIsLoading(false);
        }
    };

    // 🛡️ PASO 3: Ejecutar Cambio Físico de Clave
    const handleResetPasswordSubmit = async (e) => {
        e.preventDefault();
        if (!resetData.code || !resetData.newPassword) {
            return Swal.fire({ icon: 'warning', title: 'Atención', text: 'Por favor llene todos los campos.', confirmButtonColor: '#2563eb', customClass: { popup: 'rounded-3xl' } });
        }

        setIsLoading(true);
        try {
            await AuthService.resetPassword({
                email: forgotEmail,
                code: resetData.code,
                newPassword: resetData.newPassword
            });

            Swal.fire({
                icon: 'success',
                title: 'Cambio Exitoso',
                text: 'Su contraseña ha sido actualizada. Ya puede ingresar.',
                confirmButtonColor: '#2563eb',
                customClass: { popup: 'rounded-3xl' }
            });
            
            setStep('LOGIN');
            setCredentials({ username: '', password: '' });
            setResetData({ code: '', newPassword: '' });
            setForgotEmail('');
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error || 'El código es incorrecto o ha expirado.', confirmButtonColor: '#2563eb', customClass: { popup: 'rounded-3xl' } });
        } finally {
            setIsLoading(false);
        }
    };

    // 🛡️ Selección de Estación/Caja
    const handleSelectRegister = (registerId) => {
        if (!registerId) {
            // Aseguramos que la memoria de la caja quede limpia al ir a gerencia
            localStorage.removeItem('bms_active_register');
            onLoginSuccess(loggedUser);
            return;
        }
        const selectedRegister = registers.find(r => r.id === registerId);
        localStorage.setItem('bms_active_register', JSON.stringify(selectedRegister));
        onLoginSuccess(loggedUser);
    };

    // 🚨 [NUEVO] LECTURA DINÁMICA DE MARCA PARA LA PANTALLA DE ESTACIÓN DE TRABAJO
    const currentLogoUrl = (loggedUser?.identity?.logoUrl && loggedUser.identity.logoUrl.trim() !== '') 
        ? loggedUser.identity.logoUrl 
        : tenantConfig.logoUrl;
        
    const currentTradeName = loggedUser?.identity?.tradeName || tenantConfig.tradeName || tenantConfig.companyName || 'BMS-POS';
    
    const currentCompanyInitial = loggedUser?.identity?.companyName 
        ? loggedUser.identity.companyName.trim().charAt(0).toUpperCase() 
        : (tenantConfig.companyName ? tenantConfig.companyName.trim().charAt(0).toUpperCase() : 'B');

    return (
        <div className="min-h-[100dvh] w-full flex items-center justify-center bg-[#f0f4f8] relative overflow-hidden select-none font-sans text-slate-800">
            
            {/* FONDO DINÁMICO */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                <motion.div 
                    animate={{ x: [0, 40, -20, 0], y: [0, -40, 20, 0] }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    className="absolute top-[-15%] left-[-5%] w-[45rem] h-[45rem] bg-blue-500/30 rounded-full blur-[80px] md:blur-[100px] transform-gpu will-change-transform" 
                />
                <motion.div 
                    animate={{ x: [0, -50, 30, 0], y: [0, 50, -30, 0] }}
                    transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
                    className="absolute bottom-[-10%] right-[-10%] w-[50rem] h-[50rem] bg-indigo-500/20 rounded-full blur-[90px] md:blur-[120px] transform-gpu will-change-transform" 
                />
                <motion.div 
                    animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
                    transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-[20%] left-[30%] w-[35rem] h-[35rem] bg-sky-400/20 rounded-full blur-[70px] md:blur-[90px] transform-gpu will-change-transform" 
                />
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMCwwLDAsMC4wMikiLz48L3N2Zz4=')] opacity-50"></div>
            </div>

            <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-[28rem] px-5 sm:px-10 py-8 sm:py-10 bg-white/50 backdrop-blur-2xl border border-white/80 rounded-3xl sm:rounded-[2.5rem] shadow-[0_8px_32px_0_rgba(37,99,235,0.07)] relative z-10 mx-4 sm:mx-0 group"
            >
                
                {/* Cabecera Adaptativa */}
                <div className="flex flex-col items-center mb-8 sm:mb-10 relative">
                    <motion.div 
                        whileHover={{ scale: 1.05, rotate: 2 }} 
                        whileTap={{ scale: 0.95 }}
                        className="mb-4 sm:mb-5 relative rounded-2xl transition-shadow"
                    >
                        <div className="relative p-2 rounded-2xl bg-white/80 backdrop-blur-md border border-white shadow-lg">
                            {currentLogoUrl ? (
                                <img src={currentLogoUrl} alt="Logo" className="h-14 w-14 sm:h-16 sm:w-16 object-contain rounded-xl" />
                            ) : (
                                <div className="h-14 w-14 sm:h-16 sm:w-16 bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-700 rounded-xl flex items-center justify-center text-white font-black text-3xl sm:text-4xl shadow-inner">
                                    {currentCompanyInitial}
                                </div>
                            )}
                        </div>
                    </motion.div>
                    
                    <motion.h1 layout className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight text-center">
                        {step === 'LOGIN' && currentTradeName}
                        {step === 'SELECT_REGISTER' && 'Estación de Trabajo'}
                        {step === 'FORGOT_PASSWORD' && 'Recuperar Acceso'}
                        {step === 'RESET_PASSWORD' && 'Establecer Clave'}
                    </motion.h1>
                    <motion.p layout className="text-[10px] sm:text-xs text-slate-500 font-semibold mt-1 sm:mt-2 text-center tracking-wide">
                        {step === 'LOGIN' && 'Tu Contabilidad Digital'}
                        {step === 'SELECT_REGISTER' && `Bienvenido, ${loggedUser?.full_name || 'Usuario'}`}
                        {step === 'FORGOT_PASSWORD' && 'Proceso de verificación cifrado'}
                        {step === 'RESET_PASSWORD' && 'Ingrese el código de seguridad de 6 dígitos'}
                    </motion.p>
                </div>

                <AnimatePresence mode="wait">
                    
                    {/* PASO A: LOGIN */}
                    {step === 'LOGIN' && (
                        <motion.form 
                            key="login-form"
                            variants={pageTransition}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            onSubmit={handleLogin} 
                            className="space-y-5 sm:space-y-6"
                        >
                            <div className="group relative">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 transition-colors group-focus-within:text-blue-600">Usuario</label>
                                <div className="relative mt-1.5 sm:mt-2">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 transition-colors group-focus-within:text-blue-600">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                    </span>
                                    <Input 
                                        required
                                        placeholder="Ingrese su usuario"
                                        value={credentials.username}
                                        onChange={(e) => setCredentials({ ...credentials, username: e.target.value.trim().toLowerCase() })}
                                        className="w-full !pl-12 !pr-12 !bg-white/60 !border-white/50 !text-slate-800 !text-base placeholder:text-slate-400 focus:!bg-white focus:!border-blue-500 focus:!ring-4 focus:!ring-blue-500/20 !rounded-2xl sm:!rounded-[1.25rem] !py-3.5 sm:!py-4 font-bold transition-all shadow-sm backdrop-blur-sm"
                                    />
                                </div>
                            </div>

                            <div className="group relative">
                                <div className="flex items-center px-1 mb-1.5 sm:mb-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest transition-colors group-focus-within:text-blue-600">Contraseña</label>
                                </div>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 transition-colors group-focus-within:text-blue-600">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                    </span>
                                    <Input 
                                        required
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••••••"
                                        value={credentials.password}
                                        onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                                        className="w-full !pl-12 !pr-12 !bg-white/60 !border-white/50 !text-slate-800 !text-base placeholder:text-slate-400 focus:!bg-white focus:!border-blue-500 focus:!ring-4 focus:!ring-blue-500/20 !rounded-2xl sm:!rounded-[1.25rem] !py-3.5 sm:!py-4 font-bold transition-all shadow-sm tracking-widest backdrop-blur-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-blue-600 transition-colors outline-none focus:outline-none"
                                    >
                                        {showPassword ? (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                                        ) : (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                        )}
                                    </button>
                                </div>
                                <div className="flex justify-end mt-2">
                                    <button 
                                        type="button" 
                                        onClick={() => setStep('FORGOT_PASSWORD')}
                                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 tracking-wide transition-colors outline-none focus:outline-none focus:underline"
                                    >
                                        ¿Olvidó su clave?
                                    </button>
                                </div>
                            </div>

                            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                <Button 
                                    type="submit" 
                                    disabled={isLoading}
                                    className="w-full !rounded-[1.25rem] !py-3.5 sm:!py-4 mt-2 font-bold text-sm tracking-wide bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 hover:from-blue-600 hover:via-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center overflow-hidden relative group border-0"
                                >
                                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent group-hover:animate-[shimmer_1.5s_infinite]"></div>
                                    {isLoading ? (
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        'Acceder al Sistema'
                                    )}
                                </Button>
                            </motion.div>
                        </motion.form>
                    )}

                    {/* PASO B: SELECCIÓN DE ESTACIÓN */}
                    {step === 'SELECT_REGISTER' && (
                        <motion.div 
                            key="register-step"
                            variants={pageTransition}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="space-y-4"
                        >
                            <div className="max-h-[16rem] md:max-h-[20rem] overflow-y-auto pr-1 sm:pr-2 space-y-3 custom-scrollbar">
                                {(() => {
                                    const myActiveRegister = registers.find(r => r.shift_status === 'ABIERTA' && r.occupant_id === loggedUser?.id);
                                    
                                    // 🚀 Identificamos el rol de forma segura
                                    const userRole = (loggedUser?.role || '').toUpperCase();
                                    const isManager = userRole === 'ADMINISTRADOR' || userRole === 'SUPERVISOR';

                                    return registers.map((reg) => {
                                        const isOpen = reg.shift_status === 'ABIERTA';
                                        const isOccupiedByOther = isOpen && reg.occupant_id !== loggedUser?.id;
                                        const isOccupiedByMe = isOpen && reg.occupant_id === loggedUser?.id;
                                        const isBlockedForMe = myActiveRegister && !isOccupiedByMe;
                                        
                                        const cannotEnter = (isOccupiedByOther && !isManager) || isBlockedForMe;

                                        return (
                                            <motion.button
                                                whileHover={cannotEnter ? {} : { scale: 1.01, x: 4 }}
                                                whileTap={cannotEnter ? {} : { scale: 0.98 }}
                                                key={reg.id}
                                                onClick={() => {
    // --- 1. CAJA OCUPADA POR OTRO USUARIO ---
    if (isOccupiedByOther) {
        if (isManager) {
            // 🛡️ MODAL LEGAL DE AUDITORÍA (Diseño limpio y responsive)
            Swal.fire({
                icon: 'warning',
                title: 'Modo Auditoría Fiscal',
                html: `
                    <div class="text-left mt-2">
                        <p class="text-sm text-slate-600">Estás a punto de entrar a la caja operada por <b>${reg.occupant_name}</b>.</p>
                        <div class="bg-amber-50 border-l-4 border-amber-500 p-3 mt-3 rounded-r-xl">
                            <p class="text-[10px] font-black text-amber-700 uppercase tracking-widest">Advertencia Legal</p>
                            <p class="text-xs text-amber-600 font-medium mt-1">Podrás revisar movimientos y emitir Reportes X/Z, pero no facturar a tu nombre.</p>
                        </div>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'Sí, Auditar Caja',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#4f46e5',
                cancelButtonColor: '#e2e8f0',
                customClass: { 
                    popup: 'rounded-[2rem] w-[90%] sm:w-auto',
                    confirmButton: 'w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 px-4 rounded-xl transition-all shadow-lg active:scale-95 outline-none text-xs mt-2',
                    cancelButton: 'w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 px-4 rounded-xl transition-all outline-none text-xs mt-2',
                    actions: 'flex flex-col gap-0 w-full px-4'
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    handleSelectRegister(reg.id); 
                }
            });
        } else {
            // Expulsión de Cajero
            Swal.fire({
                icon: 'error',
                title: 'Acceso Denegado',
                text: `La caja está en uso por ${reg.occupant_name}. No tienes permisos para acceder.`,
                confirmButtonColor: '#e11d48',
                customClass: { popup: 'rounded-[2rem] w-[90%] sm:w-auto' }
            }).then(() => {
                localStorage.removeItem('bms_token');
                localStorage.removeItem('bms_user');
                setLoggedUser(null);
                setCredentials({ username: '', password: '' });
                setStep('LOGIN');
            });
        }
    } 
    // --- 2. CAJA BLOQUEADA (EL USUARIO YA TIENE OTRA ABIERTA) ---
    else if (isBlockedForMe) {
        // 🛡️ BLOQUEO CRUZADO: Tiene otra caja abierta
        Swal.fire({
            icon: 'error',
            title: 'Acceso Denegado',
            html: `
                <div class="text-left font-sans mt-2">
                    <p class="text-sm text-slate-600 mb-4">Por normativas de <b>Seguridad Fiscal</b>, no pueden existir dos turnos de facturación simultáneos para el mismo usuario.</p>
                    <div class="bg-rose-50 border border-rose-200 rounded-xl p-3 flex gap-3">
                        <svg class="w-6 h-6 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                        <div>
                            <p class="text-[9px] font-black text-rose-700 uppercase tracking-widest mb-1">Error Crítico</p>
                            <p class="text-xs text-rose-700 font-medium">Ya tienes un turno activo en otra estación. Debes cerrarlo primero.</p>
                        </div>
                    </div>
                </div>
            `,
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#0f172a',
            customClass: { 
                popup: 'rounded-[2rem] w-[90%] sm:w-auto',
                confirmButton: 'w-full bg-slate-900 hover:bg-black text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-md mt-2 outline-none'
            }
        });
    } 
    // --- 3. CAJA CERRADA (INTENTO DE APERTURA) ---
    else if (!isOpen) {
        // ⚖️ BLINDAJE LEGAL: El Administrador Maestro no puede facturar
        if (loggedUser?.role === 'ADMINISTRADOR') {
            Swal.fire({
                icon: 'error',
                title: 'Restricción de Rol',
                html: `
                    <div class="text-left font-sans mt-2">
                        <p class="text-sm text-slate-600 mb-4">El rol <b>Administrador Maestro</b> tiene bloqueada la apertura de turnos por políticas de control interno.</p>
                        <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 flex gap-3 shadow-sm">
                            <svg class="w-6 h-6 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"></path></svg>
                            <div>
                                <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Normativa Vigente</p>
                                <p class="text-xs text-slate-600 font-medium leading-relaxed">Usted solo está autorizado para auditar cajas que ya hayan sido aperturadas por un Cajero o Supervisor.</p>
                            </div>
                        </div>
                    </div>
                `,
                confirmButtonText: 'Entendido',
                confirmButtonColor: '#0f172a',
                customClass: { 
                    popup: 'rounded-[2rem] w-[90%] sm:w-auto',
                    confirmButton: 'w-full bg-slate-900 hover:bg-black text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-md mt-2 outline-none'
                }
            });
            return;
        }

        // 🧹 PURGA DE FANTASMAS: Limpiamos la caché del navegador antes de abrir una caja nueva
        localStorage.removeItem('bms_active_shift');
        localStorage.removeItem('bms_active_register');

        // Procedemos a abrir la caja con la memoria limpia
        handleSelectRegister(reg.id);
    } 
    // --- 4. ACCEDIENDO A MI PROPIO TURNO ACTIVO ---
    else {
        handleSelectRegister(reg.id);
    }
}}
                                                className={`w-full flex items-center justify-between p-3.5 sm:p-4 backdrop-blur-md border rounded-[1.15rem] transition-all duration-300 outline-none shadow-sm ${
                                                    isOpen && isOccupiedByMe
                                                        ? 'bg-blue-50/80 border-blue-200 hover:bg-blue-50 hover:border-blue-400 group hover:shadow-md' 
                                                        : isOccupiedByOther
                                                            ? (isManager 
                                                                ? 'bg-indigo-50/80 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-400 group hover:shadow-md' 
                                                                : 'bg-slate-50/50 border-slate-200 opacity-70 cursor-not-allowed')
                                                            : isBlockedForMe
                                                                ? 'bg-slate-50/60 border-slate-200 opacity-60 cursor-not-allowed'
                                                                : 'bg-emerald-50/80 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-400 group hover:shadow-md'
                                                }`}
                                            >
                                                {/* 📱 CONTENEDOR IZQUIERDO RESPONSIVE: Uso de min-w-0 y flex-1 para truncar textos en móviles */}
                                                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                                                    <div className={`p-2.5 sm:p-3 rounded-xl transition-colors duration-300 shadow-sm border flex items-center justify-center shrink-0 ${
                                                        isOpen && isOccupiedByMe
                                                            ? 'bg-blue-100/80 text-blue-600 border-blue-200 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-500' 
                                                            : isOccupiedByOther
                                                                ? (isManager
                                                                    ? 'bg-indigo-100/80 text-indigo-600 border-indigo-200 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-500'
                                                                    : 'bg-slate-100 text-slate-400 border-slate-200')
                                                                : isBlockedForMe
                                                                    ? 'bg-slate-100 text-slate-400 border-slate-200'
                                                                    : 'bg-emerald-100/80 text-emerald-600 border-emerald-200 group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-500'
                                                    }`}>
                                                        {isOpen ? (
                                                            isOccupiedByOther && isManager ? (
                                                                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                            ) : (
                                                                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                            )
                                                        ) : (
                                                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3h6m-6 4h6m-6 4h6m-6 4h6M9 21h6" /></svg>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="text-left min-w-0 flex-1 pr-2">
                                                        <div className={`text-[13px] sm:text-sm font-bold transition-colors truncate w-full ${
                                                            isOpen ? (isOccupiedByOther && isManager ? 'text-indigo-800' : 'text-blue-800') : isBlockedForMe ? 'text-slate-500' : 'text-emerald-800 group-hover:text-emerald-900'
                                                        }`}>
                                                            {reg.name}
                                                        </div>
                                                        <div className={`text-[9px] sm:text-[10px] font-bold tracking-[0.1em] uppercase mt-0.5 sm:mt-1 flex items-center gap-1.5 w-full ${
                                                            isOpen ? (isOccupiedByOther && isManager ? 'text-indigo-600' : 'text-blue-600') : isBlockedForMe ? 'text-slate-400' : 'text-emerald-600'
                                                        }`}>
                                                            {isOpen && <span className={`w-1.5 h-1.5 rounded-full shrink-0 animate-pulse ${isOccupiedByOther && isManager ? 'bg-indigo-500' : 'bg-blue-500'}`}></span>}
                                                            <span className="truncate">
                                                                {isOpen 
                                                                    ? (isOccupiedByMe 
                                                                        ? 'TU TURNO ACTIVO' 
                                                                        : (isManager ? `AUDITAR CAJA DE: ${reg.occupant_name}` : `OCUPADA POR: ${reg.occupant_name}`)) 
                                                                    : isBlockedForMe
                                                                        ? 'BLOQUEADA (TIENES TURNO)'
                                                                        : 'DISPONIBLE'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* 📱 CONTENEDOR DERECHO: Uso de shrink-0 para que el ícono derecho no se aplaste */}
                                                <span className={`shrink-0 ml-1 transition-colors ${
                                                    isOpen ? (isOccupiedByOther && isManager ? 'text-indigo-400 group-hover:text-indigo-600' : 'text-blue-400') : isBlockedForMe ? 'text-slate-300' : 'text-emerald-400 group-hover:text-emerald-600'
                                                }`}>
                                                    {cannotEnter ? (
                                                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                                    ) : (
                                                        <svg className="w-4 h-4 sm:w-5 sm:h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                                    )}
                                                </span>
                                            </motion.button>
                                        );
                                    });
                                })()}

                                {registers.length === 0 && (
                                    <div className="text-center p-6 sm:p-8 bg-white/40 border border-dashed border-slate-300 rounded-[1.25rem] backdrop-blur-sm">
                                        <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white mb-3 border border-slate-200 shadow-sm shrink-0">
                                            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                        </div>
                                        <p className="text-[10px] sm:text-xs font-semibold text-slate-500">No hay cajas dadas de alta en este terminal.</p>
                                    </div>
                                )}
                            </div>

                            {(() => {
                                const uRole = (loggedUser?.role || '').toUpperCase();
                                if (uRole === 'ADMINISTRADOR' || uRole === 'SUPERVISOR') {
                                    // 🚀 LÓGICA DE BLINDAJE: Oculta el botón de gerencia si el admin tiene un turno abierto
                                    const myActiveRegister = registers.find(r => r.shift_status === 'ABIERTA' && r.occupant_id === loggedUser?.id);
                                    if (!myActiveRegister) {
                                        return (
                                            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} className="pt-3 sm:pt-4 mt-3 sm:mt-4 border-t border-slate-200/50">
                                                <Button 
                                                    onClick={() => handleSelectRegister(null)}
                                                    className="w-full !bg-white/60 hover:!bg-white backdrop-blur-md !text-slate-600 hover:!text-blue-700 border border-white !rounded-[1.15rem] py-3.5 text-[11px] sm:text-xs font-bold tracking-[0.15em] uppercase transition-all shadow-sm focus:outline-none focus:ring-transparent"
                                                >
                                                    Acceso Directo a Gerencia
                                                </Button>
                                            </motion.div>
                                        );
                                    }
                                }
                                return null;
                            })()}
                        </motion.div>
                    )}

                    {/* PASO C: RECUPERAR CLAVE */}
                    {step === 'FORGOT_PASSWORD' && (
                        <motion.form 
                            key="forgot-step"
                            variants={pageTransition}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            onSubmit={handleForgotPasswordSubmit} 
                            className="space-y-5 sm:space-y-6"
                        >
                            <div className="group relative">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 transition-colors group-focus-within:text-blue-600">Correo Corporativo</label>
                                <div className="relative mt-1.5 sm:mt-2">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 transition-colors group-focus-within:text-blue-600">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                    </span>
                                    <Input 
                                        required
                                        type="email"
                                        placeholder="ejemplo@empresa.com"
                                        value={forgotEmail}
                                        onChange={(e) => setForgotEmail(e.target.value.trim())}
                                        className="w-full !pl-12 !pr-12 !bg-white/60 !border-white/50 !text-slate-800 !text-base placeholder:text-slate-400 focus:!bg-white focus:!border-blue-500 focus:!ring-4 focus:!ring-blue-500/20 !rounded-2xl sm:!rounded-[1.25rem] !py-3.5 sm:!py-4 font-bold transition-all shadow-sm backdrop-blur-sm"
                                    />
                                </div>
                            </div>

                            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                <Button 
                                    type="submit" 
                                    disabled={isLoading}
                                    className="w-full !rounded-[1.25rem] py-3.5 sm:py-4 font-bold text-sm tracking-wide bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 hover:from-blue-600 hover:via-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center border-0"
                                >
                                    {isLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Enviar Instrucciones'}
                                </Button>
                            </motion.div>

                            <button
                                type="button"
                                onClick={() => setStep('LOGIN')}
                                className="w-full text-center text-[10px] sm:text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors py-2 outline-none flex items-center justify-center gap-2 group focus:outline-none focus:underline"
                            >
                                <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                                Volver al inicio de sesión
                            </button>
                        </motion.form>
                    )}

                    {/* PASO D: RESETEAR CLAVE */}
                    {step === 'RESET_PASSWORD' && (
                        <motion.form 
                            key="reset-step"
                            variants={pageTransition}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            onSubmit={handleResetPasswordSubmit} 
                            className="space-y-5 sm:space-y-6"
                        >
                            <div className="group relative">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 transition-colors group-focus-within:text-blue-600">Código de Verificación (OTP)</label>
                                <Input 
                                    required 
                                    placeholder="Ej: 543210" 
                                    value={resetData.code} 
                                    onChange={(e) => setResetData({ ...resetData, code: e.target.value })} 
                                    className="w-full mt-1.5 sm:mt-2 text-center tracking-[0.5em] font-black !bg-white/60 !border-white/50 !text-blue-600 !text-base !rounded-2xl sm:!rounded-[1.25rem] !py-3.5 sm:!py-4 transition-all focus:!bg-white focus:!border-blue-500 focus:!ring-4 focus:!ring-blue-500/20 shadow-sm backdrop-blur-sm" 
                                />
                            </div>
                            
                            <div className="group relative">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 transition-colors group-focus-within:text-blue-600">Nueva Contraseña</label>
                                <div className="relative mt-1.5 sm:mt-2">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 transition-colors group-focus-within:text-blue-600">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                    </span>
                                    <Input 
                                        required 
                                        type={showPassword ? 'text' : 'password'} 
                                        placeholder="••••••••••••" 
                                        value={resetData.newPassword} 
                                        onChange={(e) => setResetData({ ...resetData, newPassword: e.target.value })} 
                                        className="w-full !pl-12 !pr-12 !bg-white/60 !border-white/50 !text-slate-800 !text-base placeholder:text-slate-400 focus:!bg-white focus:!border-blue-500 focus:!ring-4 focus:!ring-blue-500/20 !rounded-2xl sm:!rounded-[1.25rem] !py-3.5 sm:!py-4 font-bold transition-all shadow-sm tracking-widest backdrop-blur-sm" 
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-blue-600 transition-colors outline-none focus:outline-none"
                                    >
                                        {showPassword ? (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                                        ) : (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                <Button type="submit" disabled={isLoading} className="w-full !rounded-[1.25rem] py-3.5 sm:py-4 mt-2 font-bold text-sm tracking-wide bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 hover:from-blue-600 hover:via-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center border-0">
                                    {isLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Confirmar Nueva Contraseña'}
                                </Button>
                            </motion.div>
                            
                            <button type="button" onClick={() => setStep('LOGIN')} className="w-full text-center text-[10px] sm:text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors py-2 outline-none flex items-center justify-center gap-2 group focus:outline-none focus:underline">
                                <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                                Cancelar y volver al inicio
                            </button>
                        </motion.form>
                    )}

                </AnimatePresence>
            </motion.div>
            
            <div className="absolute bottom-4 sm:bottom-6 px-4 z-10 w-full opacity-60 hover:opacity-100 transition-opacity duration-300">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-widest text-center">
                    <span>BMS Digital © 2026</span>
                    <span className="hidden sm:inline opacity-50">|</span>
                    <span>Plataforma Cifrada de Alta Seguridad</span>
                </div>
            </div>
            
        </div>
    );
};