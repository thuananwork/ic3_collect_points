# Hướng dẫn cho tác giả: cấp tài khoản và gửi phần mềm cho đồng nghiệp

Tài liệu này dành riêng cho bạn (người cấp tài khoản). Đừng gửi nó cho đồng nghiệp. Đồng nghiệp đã có `HUONG_DAN.txt` nằm sẵn trong gói phần mềm.

## Tóm tắt trong 30 giây

Bạn có **hai thứ khác nhau** cần gửi cho mỗi đồng nghiệp:

1. **Phần mềm**: một file `.zip` của thư mục `release\ic3_collect_points`. Mọi đồng nghiệp dùng chung đúng một bản này. Gửi một lần là đủ.
2. **Giấy phép**: một file `account.lic` riêng cho từng người, do bạn tạo bằng `CapTaiKhoan.bat`.

Phần mềm không có giấy phép thì chỉ hiện màn hình đăng nhập, không dùng được. Khi cấp, bạn chọn một trong hai loại tài khoản (hai nút lớn trong trang cấp tài khoản):

- **Tài khoản thường (khoá theo máy)**: chỉ chạy trên các máy có Mã máy ghi trong file (tối đa 4 máy, hoặc số bạn chọn, trần 20). Bạn cần xin Mã máy của người đó trước khi cấp.
- **Tài khoản mọi máy (không khoá)**: **bạn cấp ngay, không cần xin gì**. Bạn gửi file `account.lic` và người nhận đăng nhập được ở **máy nào cũng được**, miễn có file đó, đến hết số tháng đã cấp. Dành cho một vài tài khoản đặc biệt.

Lưu ý thật thà: phần mềm chạy offline nên **không thể "đếm số máy đã đăng nhập"**, vì máy này không biết máy kia đã dùng. Muốn khoá số máy thì chỉ có cách ghi sẵn mã máy vào file (kiểu ràng buộc theo mã máy).

## Các thư mục trong `D:\Project\ic3_collect_points` và việc của từng thư mục

| Thư mục / file | Là gì | Bạn làm gì với nó |
|---|---|---|
| `release\ic3_collect_points\` | **Bản phần mềm hoàn chỉnh** để phát cho đồng nghiệp. Ngoài cùng chỉ có 2 file `ic3_collect_points.exe`, `TaoDeThi.exe` và thư mục `he_thong` (chứa giao diện, `scripts`, `Data`, `account.lic`, `HUONG_DAN.txt`, `LICENSE.txt`) | **Nén thư mục này thành `.zip` rồi gửi.** Đây là thứ duy nhất bạn gửi làm phần mềm |
| `tools\captaikhoan\CapTaiKhoan.bat` | Công cụ cấp tài khoản của bạn, mở ra một trang web trên máy bạn | Bấm đúp mỗi khi cần cấp, gia hạn hoặc thêm máy. **Không gửi cho ai** |
| `CapPhat\<tên>_<ngày>\account.lic` | **File giấy phép** do công cụ tạo ra | Gửi đúng file này cho đúng người. Mỗi người một file. Trang cấp tài khoản cũng có nút "Tải account.lic" và nút mở thư mục này |
| `secrets\signing.key` | **Con dấu của bạn**, dùng để ký mọi giấy phép | **Sao lưu ra USB, cất kỹ, không gửi ai, không đưa lên GitHub.** Mất file này là không cấp thêm hay gia hạn được cho ai nữa. Lộ file này là ai cũng tự cấp giấy phép được |
| `backend\src\config\pubkey.txt` | Khoá công khai tương ứng, đã được đóng sẵn vào phần mềm | Không cần làm gì. Không bí mật |
| `build\` | Thư mục tạm khi đóng gói | Bỏ qua, xoá được |
| `tools\release\build_release.bat` | Tạo lại bản phần mềm trong `release\` | Chỉ chạy khi phần mềm có sửa đổi (xem mục E) |

Cách nhớ nhanh: **gửi `release\...` (dạng zip) và gửi từng `account.lic` trong `CapPhat\...`. Mọi thứ còn lại ở lại máy bạn.**

## A. Việc chuẩn bị, chỉ làm một lần (bạn đã làm xong)

Bạn đã tạo khoá (`keygen`) và đã build ra thư mục `release\ic3_collect_points`. Hai việc này không cần làm lại, trừ khi mình bảo bạn build lại vì có sửa phần mềm.

**Tuyệt đối không chạy lại `keygen`.** Chạy lại sẽ sinh ra con dấu mới, và mọi `account.lic` đã cấp từ trước sẽ không còn dùng được.

Hai việc còn lại bạn nên làm một lần:

1. Chép `secrets\signing.key` ra USB để sao lưu.
2. Mở `tools\release\LICENSE.txt`, điền email liên hệ vào dòng cuối, rồi chạy lại `tools\release\build_release.bat` một lần để email đó có trong gói gửi đi.

## B. Mỗi khi có một đồng nghiệp mới

Quy trình có hai loại, khác nhau ở chỗ có xin Mã máy hay không.

**Tài khoản mọi máy:** không có lượt xin gì cả. Bạn gửi phần mềm (bước 1), tự cấp file (bước 2, bấm nút "Tài khoản mọi máy") rồi gửi file cùng tên đăng nhập, mật khẩu (bước 3). Xong.

**Tài khoản thường:** có thêm một lượt xin Mã máy trước bước 2. Đồng nghiệp mở `ic3_collect_points.exe`, chép **Mã máy** trên màn hình đăng nhập (dạng `B5C5-A8C8-0CC0-A787-B083`) rồi gửi cho bạn, sau đó bạn mới cấp. Nếu Windows hỏi tường lửa khi mở phần mềm thì chọn "Cho phép" trên mạng riêng.

**Bước 1. Bạn gửi phần mềm.** Nén thư mục `release\ic3_collect_points` thành `ic3_collect_points.zip` và gửi (qua Zalo, Drive, USB... đều được). Dặn họ: giải nén ra một thư mục có quyền ghi, ví dụ `D:\ic3_collect_points`, không chạy trực tiếp trong file zip. Gửi kèm lời dặn đọc file `HUONG_DAN.txt` nằm trong đó.

**Bước 2. Bạn tạo giấy phép.** Mở `tools\captaikhoan\CapTaiKhoan.bat`, vào tab "Cấp mới":
- Điền tên đồng nghiệp, tên đăng nhập (để trống thì tự đặt), email nếu muốn.
- Bấm "Tự sinh" để có mật khẩu, hoặc tự đặt (từ 8 ký tự).
- Chọn số tháng (thường 4).
- Chọn loại tài khoản. Với **Tài khoản thường**: chọn số máy tối đa (thường 4) và dán Mã máy (mỗi dòng một mã) mà đồng nghiệp gửi. Với **Tài khoản mọi máy**: không cần điền gì thêm.
- Bấm "Cấp tài khoản".

Trang hiện ra nút **Tải account.lic** và một đoạn nội dung gồm tên đăng nhập, mật khẩu, hạn dùng, kèm nút "Chép nội dung".

**Bước 3. Bạn gửi giấy phép.** Gửi file `account.lic` cho đồng nghiệp, và gửi đoạn tên đăng nhập, mật khẩu **qua một kênh khác hoặc một tin nhắn khác**, đừng gộp chung với file. Đồng nghiệp mở lại phần mềm, bấm "Chọn file account.lic" trên màn hình đăng nhập, chọn file, rồi đăng nhập bằng tên đăng nhập (hoặc email) và mật khẩu. Từ đó dùng bình thường, kể cả những lần sau chỉ cần đăng nhập.

Tóm lại, với mỗi người bạn gửi **ba thứ**: file zip phần mềm (một lần), file `account.lic`, và tên đăng nhập kèm mật khẩu.

## C. Gia hạn hoặc thêm máy cho người đã có tài khoản

Không cần gửi lại phần mềm. Mở `CapTaiKhoan.bat`, vào tab "Sửa / gia hạn":

1. Kéo file `account.lic` cũ của người đó vào (nếu mất file cũ thì lấy trong `CapPhat\...` ở tab "Đã cấp").
2. Gia hạn: nhập số tháng. Với tài khoản có ràng buộc máy: thêm máy bằng cách dán Mã máy mới vào ô "Thêm mã máy", bỏ máy cũ bằng cách bấm vào mã máy đó, cho nhiều máy hơn bốn máy thì tăng "Số máy tối đa" (ví dụ 6). Muốn đổi một tài khoản giữa hai loại (thường ↔ mọi máy) thì dùng ô "Ràng buộc máy" trong tab này.
3. Bấm "Sửa và ký lại", tải file mới và gửi cho họ.

Họ chép đè file mới vào thư mục `he_thong`, hoặc chọn lại ở màn hình đăng nhập. Tên đăng nhập và mật khẩu giữ nguyên, không cần gửi lại.

Tab "Đã cấp" cho bạn xem mọi tài khoản và còn bao nhiêu ngày. Tài khoản sắp hết hạn có nhãn vàng.

## Mã máy là gì, có bị đổi không

Mã máy là một chuỗi ngắn tính từ mã định danh `MachineGuid` mà Windows tạo ra **một lần lúc cài Windows** (lưu trong registry). Phần mềm băm mã này ra, nên không lộ mã gốc.

Những việc **không** làm đổi Mã máy: khởi động lại, cập nhật Windows, thay RAM, ổ cứng, card đồ hoạ, đổi tài khoản Windows, đổi mạng hay IP, di chuyển hoặc cài lại phần mềm.

Những việc **làm đổi** Mã máy: cài lại Windows hoặc "Reset this PC" (sinh mã mới), khôi phục máy từ một bản sao hệ thống tạo trên máy khác. Khi đó đồng nghiệp gửi mã mới và bạn dùng tab "Sửa / gia hạn" để thêm máy mới và bỏ máy cũ.

Một điểm cần để ý ở phòng máy: nếu các máy được **nhân bản từ cùng một bản ghost/image** mà không chạy bước tổng quát hoá (sysprep), chúng có thể **trùng mã** với nhau. Khi đó một Mã máy dùng được cho cả nhóm máy nhân bản. Với giáo viên dùng máy riêng hoặc laptop thì không gặp trường hợp này.

Tài khoản "mọi máy" thì không phụ thuộc Mã máy, nên không lo các trường hợp trên.

## D. Đồng nghiệp dùng phần mềm mỗi buổi thi như thế nào

Phần này nằm sẵn trong `HUONG_DAN.txt` gửi kèm. Tóm tắt để bạn nắm:

1. Một lần, tạo đề cho học sinh: kéo file đề `.exe` thả lên `TaoDeThi.exe`, sẽ ra file `..._LAN.exe` cạnh file gốc (nằm cùng chỗ với file đề, không phải trong `he_thong`). File này dùng lại được nhiều buổi.
2. Mỗi buổi: mở `ic3_collect_points.exe` trên máy giáo viên, đăng nhập, chọn trường, lớp, vào Dashboard, tạo `lay_ip.bat` (IP đổi theo mạng nên làm lại mỗi nơi, mỗi buổi).
3. Chép `lay_ip.bat` và các file `_LAN.exe` sang máy học sinh. Trên máy học sinh bấm đúp `lay_ip.bat` một lần, rồi mở `_LAN.exe` làm bài. Điểm tự gửi về máy giáo viên.

Điều kiện: phần mềm trên máy giáo viên phải đang mở và giấy phép còn hạn thì điểm mới về được.

## E. Khi nào phải build lại và gửi bản mới

Bạn chỉ chạy lại `tools\release\build_release.bat` khi phần mềm có sửa đổi (mình sửa lỗi, thêm tính năng) hoặc khi bạn đổi nội dung `LICENSE.txt` hay `HUONG_DAN.txt`. Build xong, nén lại `release\ic3_collect_points` và gửi bản mới cho đồng nghiệp.

Giấy phép **không phải cấp lại**, vì con dấu vẫn là con dấu cũ. Đồng nghiệp giải nén bản mới ra, rồi chép hai thứ từ `he_thong` của bản cũ sang `he_thong` của bản mới: file `account.lic` và thư mục `Data` (chứa danh sách trường, lớp, điểm). Quên chép `Data` thì họ sẽ thấy dữ liệu trống, nhưng dữ liệu cũ vẫn còn ở thư mục cũ.

## F. Những điều không được làm

- Không gửi thư mục `tools`, `secrets`, `CapPhat` hay cả thư mục dự án cho ai. Gửi những thứ này là lộ công cụ cấp phép hoặc con dấu của bạn.
- Không gửi `signing.key`. Không đưa nó lên GitHub (dự án đã chặn sẵn, nhưng bạn đừng tự chép đi).
- Không chạy lại `keygen`.
- Không gửi `account.lic` của người này cho người khác. Với tài khoản có ràng buộc máy thì file chỉ chạy trên máy có Mã máy ghi trong đó; với tài khoản mọi máy thì ai có file là dùng được đến hết hạn.

## G. Một số giới hạn cần biết

- Không có cách nào bảo vệ mã nguồn tuyệt đối. Đóng gói bằng Nuitka làm khó việc xem mã, nhưng không đảm bảo chặn được người rất rành kỹ thuật.
- Bạn không thu hồi được giấy phép từ xa vì phần mềm chạy không cần mạng. Cách duy nhất là để nó tự hết hạn (thường 4 tháng) và không cấp lại.
- Tài khoản "mọi máy" có thể bị chép sang người khác dùng chung. Hàng rào duy nhất là hạn dùng. Nên chỉ dành kiểu này cho người bạn tin, và cấp hạn ngắn nếu chưa chắc.
- Người dùng chỉnh lùi đồng hồ máy hoặc xoá file trạng thái thì có thể vượt qua một số kiểm tra. Phần mềm có phát hiện chỉnh lùi đồng hồ, nhưng không tuyệt đối.
- Windows hoặc phần mềm diệt virus đôi khi cảnh báo nhầm với file `.exe` không có chữ ký số. Đồng nghiệp có thể gặp cảnh báo "Windows protected your PC" và phải chọn "Run anyway". Nên thử trước trên một máy sạch.
- `LICENSE.txt` là bản nháp do mình soạn, chưa qua người am hiểu pháp lý xem. Nếu bạn định phân phối rộng thì nên nhờ người có chuyên môn xem lại.

## Bảng tra nhanh theo tình huống

| Tình huống | Bạn làm gì |
|---|---|
| Có đồng nghiệp mới (tài khoản thường) | Gửi zip phần mềm, xin Mã máy, cấp `account.lic`, gửi file và mật khẩu |
| Có người cần dùng ở nhiều máy, không muốn xin mã | Gửi zip phần mềm, cấp "Tài khoản mọi máy", gửi file và mật khẩu |
| Đồng nghiệp đổi hoặc thêm máy (tài khoản có ràng buộc máy) | Xin Mã máy mới, tab "Sửa / gia hạn", thêm máy, gửi file mới. Tài khoản mọi máy thì không cần làm gì |
| Sắp hết hạn | Tab "Sửa / gia hạn", nhập số tháng, gửi file mới |
| Quên mật khẩu của họ | Cấp lại tài khoản mới với mật khẩu mới (hệ thống không lưu mật khẩu rõ, nên không tra lại được) |
| Mất file `account.lic` | Vào tab "Đã cấp" tải lại, hoặc lấy trong `CapPhat\...` |
| Có bản phần mềm mới | Chạy `build_release.bat`, nén `release\...`, gửi lại; họ chép `account.lic` và `Data` sang |
| Mất `signing.key` | Không khôi phục được. Phải tạo khoá mới, build lại và cấp lại giấy phép cho tất cả. Vì vậy hãy sao lưu |
