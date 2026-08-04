import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import apiClient from '../api/apiClient';

export const UsersManagementView = () => {
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [activeTab, setActiveTab] = useState('USERS');
    const [isLoading, setIsLoading] = useState(false);

    // 🚨 ESTADO UX: ¿Estamos editando a alguien?
    const [editingUserId, setEditingUserId] = useState(null);

    const [formUser, setFormUser] = useState({
        username: '',
        password: '',
        full_name: '',
        email: '',
        role_id: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [usersRes, rolesRes, logsRes] = await Promise.all([
                apiClient.get('/users'),
                apiClient.get('/users/roles'),
                apiClient.get('/users/audit-logs')
            ]);
            setUsers(usersRes.data);
            setRoles(rolesRes.data);
            setAuditLogs(logsRes.data);
            if (rolesRes.data.length > 0 && !editingUserId) {
                setFormUser(prev => ({ ...prev, role_id: rolesRes.data.find(r => r.name === 'CAJERO')?.id || rolesRes.data[0].id }));
            }
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar la información.' });
        } finally {
            setIsLoading(false);
        }
    };

    // 🛡️ UX MEJORA 1: Formatear Nombre
    const handleNameChange = (e) => {
        const words = e.target.value.split(' ');
        const formattedWords = words.map(word => 
            word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : ''
        );
        setFormUser({...formUser, full_name: formattedWords.join(' ')});
    };

    // 🛡️ UX MEJORA 2: Cargar datos al hacer clic en Editar
    const handleEditClick = (user, e) => {
        if (e) e.stopPropagation(); 
        
        setEditingUserId(user.id);
        const userRole = roles.find(r => r.name === user.role_name);
        
        setFormUser({
            username: user.username,
            password: '', 
            full_name: user.full_name,
            email: user.email,
            role_id: userRole ? userRole.id : (roles[0]?.id || '')
        });
        
        // UX Móvil: Hacer scroll suave hacia el formulario al editar
        if (window.innerWidth < 1024) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    // 🛡️ UX: Cancelar la edición y limpiar todo
    const handleCancelEdit = () => {
        setEditingUserId(null);
        setFormUser({
            username: '', password: '', full_name: '', email: '', 
            role_id: roles.find(r => r.name === 'CAJERO')?.id || roles[0]?.id || ''
        });
    };

    // 🛡️ SUBMIT MULTIUSO: Crea o Actualiza según el estado
    const handleSubmitForm = async (e) => {
        e.preventDefault();
        try {
            if (editingUserId) {
                await apiClient.put(`/users/${editingUserId}`, formUser);
                Swal.fire({ icon: 'success', title: 'Actualizado', text: 'Datos del usuario actualizados.', timer: 2000, showConfirmButton: false });
            } else {
                await apiClient.post('/users', formUser);
                Swal.fire({ icon: 'success', title: 'Creado', text: 'Usuario registrado exitosamente.', timer: 2000, showConfirmButton: false });
            }
            handleCancelEdit(); 
            fetchData(); 
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error || 'Operación fallida.' });
        }
    };

    // 🛡️ UX: Cambiar estado
    const handleToggleStatus = async (userId, currentStatus, e) => {
        if (e) e.stopPropagation(); 

        const newStatus = currentStatus === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
        try {
            await apiClient.put(`/users/${userId}/status`, { status: newStatus });
            fetchData(); 
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error || 'No se pudo cambiar el estado.' });
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-y-auto lg:overflow-hidden fade-in p-4 sm:p-6 lg:p-8">
            
            {/* HEADER ADAPTATIVO */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4 shrink-0">
                <div className="w-full lg:w-auto">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">Seguridad y Accesos</h2>
                    <p className="text-xs sm:text-sm text-slate-500 font-medium">Gestión de usuarios y auditoría del sistema</p>
                </div>
                
                <div className="flex w-full lg:w-auto bg-white p-1 rounded-xl shadow-sm border border-slate-200 overflow-x-auto no-scrollbar">
                    <button 
                        onClick={() => setActiveTab('USERS')}
                        className={`flex-1 lg:flex-none px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all whitespace-nowrap outline-none ${activeTab === 'USERS' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
                    >
                        Usuarios del Sistema
                    </button>
                    <button 
                        onClick={() => setActiveTab('AUDIT')}
                        className={`flex-1 lg:flex-none px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all whitespace-nowrap outline-none ${activeTab === 'AUDIT' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
                    >
                        Bitácora (Auditoría)
                    </button>
                </div>
            </div>

            {/* CONTENIDO (GRILLA O STACK DEPENDIENDO DE LA PANTALLA) */}
            <div className="flex-1 flex flex-col lg:flex-row gap-4 sm:gap-6 min-h-0">
                
                {activeTab === 'USERS' && (
                    <>
                        {/* 🚨 FORMULARIO MUTANTE (CREAR / EDITAR) */}
                        <div className={`w-full lg:w-1/3 p-5 sm:p-6 rounded-2xl shadow-sm border overflow-visible lg:overflow-y-auto custom-scrollbar transition-all duration-300 shrink-0 ${editingUserId ? 'bg-blue-50/50 border-blue-200' : 'bg-white border-slate-200'}`}>
                            <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-4 flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    {editingUserId ? (
                                        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    ) : (
                                        <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                                    )}
                                    {editingUserId ? 'Editar Usuario' : 'Nuevo Usuario'}
                                </span>
                                {editingUserId && (
                                    <button type="button" onClick={handleCancelEdit} className="text-[10px] sm:text-xs bg-white text-slate-400 hover:text-red-500 px-2 py-1 rounded-md border border-slate-200 shadow-sm font-bold transition-colors outline-none active:scale-95">
                                        Cancelar
                                    </button>
                                )}
                            </h3>
                            
                            <form onSubmit={handleSubmitForm} className="space-y-4">
                                <div>
                                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Completo</label>
                                    <Input required placeholder="Ej: Juan Pérez" value={formUser.full_name} onChange={handleNameChange} className="w-full mt-1.5 [&_input]:!text-sm" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-3">
                                    <div>
                                        <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Usuario (Login)</label>
                                        <Input 
                                            required 
                                            placeholder="Ej: jperez" 
                                            value={formUser.username} 
                                            onChange={e => setFormUser({...formUser, username: e.target.value.toLowerCase()})} 
                                            className={`w-full mt-1.5 [&_input]:!text-sm ${editingUserId ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}`}
                                            disabled={!!editingUserId} 
                                            title={editingUserId ? "El nombre de usuario no se puede modificar" : ""}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 truncate block">
                                            {editingUserId ? 'Nueva Clave' : 'Clave Temporal'}
                                        </label>
                                        <Input 
                                            required={!editingUserId} 
                                            type="password" 
                                            placeholder={editingUserId ? "Opcional..." : "••••••••"} 
                                            value={formUser.password} 
                                            onChange={e => setFormUser({...formUser, password: e.target.value})} 
                                            className="w-full mt-1.5 placeholder:text-[10px] [&_input]:!text-sm" 
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Correo Electrónico</label>
                                    <Input required type="email" placeholder="juan@empresa.com" value={formUser.email} onChange={e => setFormUser({...formUser, email: e.target.value})} className="w-full mt-1.5 [&_input]:!text-sm" />
                                </div>
                                <div>
                                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rol en el Sistema</label>
                                    <select 
                                        required 
                                        value={formUser.role_id} 
                                        onChange={e => setFormUser({...formUser, role_id: e.target.value})}
                                        className="w-full mt-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-medium outline-none transition-all cursor-pointer"
                                    >
                                        {roles.map(r => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <Button 
                                    type="submit" 
                                    variant="primary" 
                                    className={`w-full !rounded-xl py-3.5 sm:py-3 mt-4 text-sm uppercase tracking-widest font-black active:scale-95 transition-transform outline-none ${editingUserId ? '!bg-blue-600 hover:!bg-blue-700 shadow-blue-500/30' : '!bg-emerald-600 hover:!bg-emerald-700 shadow-emerald-500/30'}`}
                                >
                                    {editingUserId ? 'Actualizar Datos' : 'Registrar Usuario'}
                                </Button>
                            </form>
                        </div>

                        {/* TABLA DE USUARIOS CON SCROLL HORIZONTAL PROTEGIDO */}
                        <div className="w-full lg:w-2/3 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden min-h-[400px]">
                            <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
                                <table className="w-full text-left border-collapse min-w-[600px]">
                                    <thead className="bg-slate-50/95 backdrop-blur-sm sticky top-0 z-10 border-b border-slate-100">
                                        <tr>
                                            <th className="p-4 text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-wider">Personal</th>
                                            <th className="p-4 text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-wider text-center">Rol</th>
                                            <th className="p-4 text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-wider text-right">Último Acceso</th>
                                            <th className="p-4 text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-wider text-center">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {users.map(u => (
                                            <tr 
                                                key={u.id} 
                                                onClick={() => handleEditClick(u)}
                                                className={`transition-colors cursor-pointer group ${editingUserId === u.id ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}
                                            >
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 shrink-0 rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center font-black text-lg shadow-sm">
                                                            {u.full_name.charAt(0)}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="font-bold text-slate-800 text-sm sm:text-base truncate">{u.full_name}</div>
                                                            <div className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">@{u.username} • {u.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className={`inline-block px-2.5 sm:px-3 py-1 rounded-md text-[9px] sm:text-[10px] font-black tracking-widest uppercase border ${u.role_name === 'ADMINISTRADOR' ? 'bg-purple-50 text-purple-600 border-purple-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                                        {u.role_name}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-xs font-medium text-slate-500 text-right whitespace-nowrap">
                                                    {u.last_login ? new Date(u.last_login).toLocaleString('es-VE', {dateStyle:'short', timeStyle:'short'}) : 'Nunca'}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleEditClick(u, e)}
                                                            className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors shadow-sm active:scale-95 outline-none"
                                                            title="Editar datos del usuario"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                        </button>

                                                        <button 
                                                            type="button"
                                                            onClick={(e) => handleToggleStatus(u.id, u.status, e)}
                                                            className={`px-3 py-2 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 outline-none border ${u.status === 'ACTIVO' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'}`}
                                                            title="Clic para Activar / Inactivar"
                                                        >
                                                            {u.status}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}

                {activeTab === 'AUDIT' && (
                    <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden min-h-[500px]">
                        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
                            <h3 className="text-xs sm:text-sm font-bold text-slate-700">Últimos 200 movimientos registrados</h3>
                            <Button onClick={fetchData} variant="secondary" className="!py-1.5 !px-4 !text-xs !shadow-sm w-full sm:w-auto">Actualizar</Button>
                        </div>
                        <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-[700px]">
                                <thead className="bg-slate-50/95 backdrop-blur-sm sticky top-0 z-10 border-b border-slate-100">
                                    <tr>
                                        <th className="p-4 text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider">Fecha y Hora</th>
                                        <th className="p-4 text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider">Usuario</th>
                                        <th className="p-4 text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider">Acción</th>
                                        <th className="p-4 text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider">Módulo</th>
                                        <th className="p-4 text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider">Detalles</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {auditLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors text-[11px] sm:text-xs font-medium">
                                            <td className="p-4 text-slate-500 whitespace-nowrap">{new Date(log.created_at).toLocaleString('es-VE')}</td>
                                            <td className="p-4 font-bold text-slate-700 truncate max-w-[120px]" title={log.user_name || 'Sistema'}>{log.user_name || 'Sistema'}</td>
                                            <td className="p-4">
                                                <span className="inline-block px-2 py-1 bg-slate-100 border border-slate-200 text-slate-600 rounded-md text-[8px] sm:text-[9px] font-black uppercase tracking-widest">
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="p-4 text-slate-500 font-bold">{log.module}</td>
                                            <td className="p-4 text-slate-600 min-w-[200px] leading-relaxed">{log.details}</td>
                                        </tr>
                                    ))}
                                    {auditLogs.length === 0 && (
                                        <tr><td colSpan="5" className="p-10 text-center text-slate-400 font-medium">No hay registros en la bitácora.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};