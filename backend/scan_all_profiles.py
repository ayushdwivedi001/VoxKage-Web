import os
import sqlite3
import glob

def scan_all_browser_profiles():
    print("Scanning all Chrome/Edge/Brave/Firefox profile directories for Pinterest cookies...")
    
    user_home = os.path.expanduser('~')
    patterns = [
        user_home + r'\AppData\Local\Google\Chrome\User Data\*\Network\Cookies',
        user_home + r'\AppData\Local\Google\Chrome\User Data\*\Cookies',
        user_home + r'\AppData\Local\Microsoft\Edge\User Data\*\Network\Cookies',
        user_home + r'\AppData\Local\BraveSoftware\Brave-Browser\User Data\*\Network\Cookies',
        user_home + r'\AppData\Roaming\Mozilla\Firefox\Profiles\*\cookies.sqlite'
    ]
    
    found_profiles = []
    
    for pattern in patterns:
        matches = glob.glob(pattern)
        for cookie_db in matches:
            temp_db = "temp_scan.db"
            try:
                with open(cookie_db, 'rb') as f_in:
                    with open(temp_db, 'wb') as f_out:
                        f_out.write(f_in.read())
                        
                conn = sqlite3.connect(temp_db)
                cursor = conn.cursor()
                
                if "sqlite" in cookie_db:
                    cursor.execute("SELECT host, name FROM moz_cookies WHERE host LIKE '%pinterest%'")
                else:
                    cursor.execute("SELECT host_key, name FROM cookies WHERE host_key LIKE '%pinterest%'")
                    
                rows = cursor.fetchall()
                if rows:
                    found_profiles.append((cookie_db, len(rows), [r[1] for r in rows]))
                    
                conn.close()
                if os.path.exists(temp_db):
                    os.remove(temp_db)
            except Exception as e:
                if os.path.exists(temp_db):
                    try: os.remove(temp_db)
                    except: pass
                    
    print(f"\nScan complete! Found Pinterest cookies in {len(found_profiles)} browser profiles:")
    for path, count, names in found_profiles:
        print(f" - Path: {path}")
        print(f"   Cookies ({count}): {set(names)}")

if __name__ == "__main__":
    scan_all_browser_profiles()
