import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export function CreateTask() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/tasks", { state: { openCreate: true } });
  }, [navigate]);
  return null;
}

export default CreateTask;
