from playwright.sync_api import sync_playwright
import time

BASE = "https://preview-sandbox--69e295c073bbccc7f63f6156.base44.app"
TEST_NAME = f"Debug {int(time.time())}"
TEST_EMAIL = f"debug{int(time.time())}@teste.com.br"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    # Capture console logs
    logs = []
    page.on("console", lambda msg: logs.append(f"[{msg.type}] {msg.text}"))
    
    page.goto(f"{BASE}/calculo")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)
    
    # Type into fields (more reliable for React)
    name_input = page.locator("input").first
    email_input = page.locator("input").nth(1)
    
    name_input.click()
    name_input.fill("")
    name_input.type(TEST_NAME, delay=50)
    
    email_input.click()
    email_input.fill("")
    email_input.type(TEST_EMAIL, delay=50)
    
    page.wait_for_timeout(500)
    
    # Check button state
    btn = page.locator("button:has-text('Começar')")
    is_disabled = btn.is_disabled()
    print(f"Button disabled: {is_disabled}")
    print(f"Name value: '{name_input.input_value()}'")
    print(f"Email value: '{email_input.input_value()}'")
    
    page.screenshot(path="/tmp/debug_before_click.png")
    
    btn.click()
    page.wait_for_timeout(3000)
    page.screenshot(path="/tmp/debug_after_click.png")
    
    body_text = page.locator("body").inner_text()[:800]
    print(f"After click body: {body_text}")
    
    # Check console errors
    errors = [l for l in logs if "error" in l.lower() or "fail" in l.lower()]
    print(f"Console errors: {errors[:5]}")
    
    browser.close()