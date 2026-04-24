import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Redireciona para Parametrizações → aba Usuários (consolidado lá)
export default function UsersPermissions() {
  const navigate = useNavigate();
  useEffect(() => { navigate("/parametrizacoes", { replace: true }); }, [navigate]);
  return null;
}