@echo off
netsh advfirewall firewall delete rule name="XAMPP_HTTP_SERVER"
netsh advfirewall firewall add rule name="XAMPP_HTTP_SERVER" dir=in action=allow protocol=TCP localport=80
echo Da mo cong 80 vinh vien!
pause