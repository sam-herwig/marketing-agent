import httpx
from typing import Dict, List, Optional
from app.core.config import settings
import base64

class N8NService:
    def __init__(self):
        self.base_url = "http://n8n:5678/api/v1"
        self.auth = base64.b64encode(b"admin:admin123").decode()
        self.headers = {
            "Authorization": f"Basic {self.auth}",
            "Content-Type": "application/json"
        }
    
    async def get_workflows(self) -> List[Dict]:
        """Get all workflows from n8n"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.base_url}/workflows",
                    headers=self.headers
                )
                if response.status_code == 200:
                    return response.json().get("data", [])
                return []
            except Exception as e:
                print(f"Error fetching workflows: {e}")
                return []
    
    async def get_workflow(self, workflow_id: str) -> Optional[Dict]:
        """Get a specific workflow"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.base_url}/workflows/{workflow_id}",
                    headers=self.headers
                )
                if response.status_code == 200:
                    return response.json().get("data")
                return None
            except Exception as e:
                print(f"Error fetching workflow {workflow_id}: {e}")
                return None
    
    async def activate_workflow(self, workflow_id: str) -> bool:
        """Activate a workflow"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.patch(
                    f"{self.base_url}/workflows/{workflow_id}",
                    headers=self.headers,
                    json={"active": True}
                )
                return response.status_code == 200
            except Exception as e:
                print(f"Error activating workflow {workflow_id}: {e}")
                return False
    
    async def execute_workflow(self, workflow_id: str, data: Dict) -> Optional[Dict]:
        """Execute a workflow via webhook"""
        # For webhook workflows, we'll use the webhook URL instead
        webhook_url = f"http://n8n:5678/webhook/{data.get('webhook_id', workflow_id)}"
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    webhook_url,
                    json=data,
                    timeout=30.0
                )
                if response.status_code == 200:
                    return response.json()
                return None
            except Exception as e:
                print(f"Error executing workflow {workflow_id}: {e}")
                return None
    
    async def create_workflow(self, workflow_data: Dict) -> Optional[str]:
        """Create a new workflow from template"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.base_url}/workflows",
                    headers=self.headers,
                    json=workflow_data
                )
                if response.status_code == 200:
                    return response.json().get("data", {}).get("id")
                return None
            except Exception as e:
                print(f"Error creating workflow: {e}")
                return None

n8n_service = N8NService()