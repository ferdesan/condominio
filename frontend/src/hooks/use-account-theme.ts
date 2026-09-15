import { useEffect, useRef } from 'react';
import { useAuth } from './use-auth';
import { useTheme } from './use-theme';

/**
 * Adota o tema guardado na conta num dispositivo que ainda nao escolheu.
 *
 * Sem isto, salvar o tema no perfil gravaria um valor que nada leria — e o
 * campo estaria prometendo um efeito inexistente.
 *
 * **So quando o dispositivo nao escolheu.** `hasDeviceChoice` separa "nunca
 * escolheu" de "escolheu seguir o sistema"; sem essa distincao, a preferencia da
 * conta desfaria o botao da topbar a cada carga da pagina.
 *
 * **Uma vez por montagem.** O trinco impede que a adocao volte a disparar depois
 * que alguem alternar o tema de volta para o mesmo valor do servidor — caso em
 * que `hasDeviceChoice` passa a ser verdadeiro e a condicao ja nao valeria, mas
 * o trinco torna isso independente da ordem dos efeitos.
 *
 * Fica no shell autenticado porque e onde o usuario existe: o `ThemeProvider`
 * envolve o `AuthProvider` em `App.tsx` — ele precisa aplicar o tema antes do
 * login, quando nao ha conta nenhuma para consultar.
 */
export function useAccountTheme(): void {
  const { user } = useAuth();
  const { hasDeviceChoice, setTheme } = useTheme();
  const adopted = useRef(false);

  const preferred = user?.preferences?.theme;

  useEffect(() => {
    if (adopted.current || hasDeviceChoice || !preferred) return;
    adopted.current = true;
    setTheme(preferred);
  }, [hasDeviceChoice, preferred, setTheme]);
}
