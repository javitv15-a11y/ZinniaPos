// menu-consts.ts
export const menuItems = [
  {
    icon: 'person-outline',
    text: 'Editar perfil',
    isArrow: true,
    route: 'user/edit-user'
  },
  {
    icon: 'cash-outline',
    text: 'Suscripciones y pagos',
    isArrow: true,
    route: 'user/payments'
  },
  {
    icon: 'lock-closed-outline',
    text: 'Seguridad',
    isArrow: true,
    route: 'user/security'
  },
  {
    icon: 'shield-checkmark-outline',
    text: 'Políticas de privacidad',
    isArrow: true,
    externalRoute: 'https://tu-dominio.com/privacidad' // <-- cambia esto si quieres
  },
  {
    icon: 'shield-outline',
    text: 'Acuerdos y condiciones',
    isArrow: true,
    externalRoute: 'https://tu-dominio.com/terminos' // <-- cambia esto si quieres
  },
  {
    icon: 'trash-outline',
    text: 'Eliminar mi cuenta',
    isArrow: false,
    deleteAccount: true // (corregido: antes estaba "daleteAccount")
  },
  {
    icon: 'log-out-outline',
    text: 'Salir',
    isArrow: false,
    logout: true
  }
];
