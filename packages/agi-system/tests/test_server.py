import unittest
from fastapi.testclient import TestClient
import io
from PIL import Image
from server import app


class TestServer(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "healthy")

    def test_predict_invalid_sensor(self):
        # Create a dummy image
        img = Image.new('RGB', (224, 224), color='red')
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='PNG')
        img_byte_arr = img_byte_arr.getvalue()

        # Invalid sensor data (wrong dimension)
        response = self.client.post(
            "/predict",
            data={
                "text_ids": "1,2,3",
                "sensor_data": "0.1,0.2"  # SENSOR_DIM is 10
            },
            files={"image": ("test.png", img_byte_arr, "image/png")}
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("must have 10 values", response.json()["detail"])

    def test_predict_success(self):
        # Create a dummy image
        img = Image.new('RGB', (224, 224), color='red')
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='PNG')
        img_byte_arr = img_byte_arr.getvalue()

        # Valid data
        sensor_data = ",".join([str(0.1 * i) for i in range(10)])
        response = self.client.post(
            "/predict",
            data={
                "text_ids": "1,2,3",
                "sensor_data": sensor_data
            },
            files={"image": ("test.png", img_byte_arr, "image/png")}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("action", data)
        self.assertIn("action_probability", data)
        self.assertIn("value_estimate", data)


if __name__ == "__main__":
    unittest.main()
