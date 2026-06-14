<?php
/**
 * Payments — Razorpay create-order/verify, public UPI pay page + confirm, shop UPI.
 */
class PaymentController
{
    public static function register(Router $r): void
    {
        $r->post('/payments/create-order', [self::class, 'createOrder']);
        $r->post('/payments/verify',       [self::class, 'verify']);
        $r->get('/pay/{order_id}',         [self::class, 'payPage']);
        $r->post('/pay/{order_id}/confirm', [self::class, 'confirm']);
        $r->get('/shops/{shop_id}/upi',    [self::class, 'shopUpi']);
    }

    private static function keys(): array
    {
        return [env('RAZORPAY_KEY_ID', ''), env('RAZORPAY_KEY_SECRET', '')];
    }

    public static function createOrder(array $p): void
    {
        $user = Auth::requireUser();
        [$keyId, $keySecret] = self::keys();
        if (!$keyId || !$keySecret) {
            throw new ApiException(503, 'Razorpay is not configured on this server');
        }
        $orderId = (int) Validation::require(Request::body(), 'order_id');
        $order = OrderController::find($orderId);
        self::assertOrderAccess($order, $user);
        if ($order['payment_status'] === 'paid') {
            throw new ApiException(400, 'Order is already paid');
        }
        $amountPaise = (int) round((float) $order['total'] * 100);

        $ch = curl_init('https://api.razorpay.com/v1/orders');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_USERPWD        => "$keyId:$keySecret",
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS     => json_encode([
                'amount'   => $amountPaise,
                'currency' => 'INR',
                'receipt'  => 'order_' . $order['id'],
            ]),
            CURLOPT_TIMEOUT        => 30,
        ]);
        $resp = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $rz = json_decode($resp ?: '', true);
        if ($code >= 400 || !isset($rz['id'])) {
            throw new ApiException(502, 'Razorpay order creation failed');
        }

        Database::update('orders', [
            'razorpay_order_id' => $rz['id'],
            'payment_method'    => 'razorpay',
        ], 'id = :id', ['id' => $order['id']]);

        Response::json([
            'razorpay_order_id' => $rz['id'],
            'amount'            => $amountPaise,
            'currency'         => 'INR',
            'key_id'           => $keyId,
        ]);
    }

    public static function verify(array $p): void
    {
        $user = Auth::requireUser();
        [, $keySecret] = self::keys();
        if (!$keySecret) {
            throw new ApiException(503, 'Razorpay is not configured on this server');
        }
        $b = Request::body();
        $orderId = (int) Validation::require($b, 'order_id');
        $rzOrderId   = (string) Validation::require($b, 'razorpay_order_id');
        $rzPaymentId = (string) Validation::require($b, 'razorpay_payment_id');
        $rzSignature = (string) Validation::require($b, 'razorpay_signature');

        $order = OrderController::find($orderId);
        self::assertOrderAccess($order, $user);

        $expected = hash_hmac('sha256', "$rzOrderId|$rzPaymentId", $keySecret);
        if (!hash_equals($expected, $rzSignature)) {
            throw new ApiException(400, 'Payment verification failed — invalid signature');
        }
        Database::update('orders', [
            'razorpay_payment_id' => $rzPaymentId,
            'payment_status'      => 'paid',
            'payment_method'      => 'razorpay',
        ], 'id = :id', ['id' => $order['id']]);
        Response::json(['status' => 'success', 'order_id' => (int) $order['id'], 'payment_status' => 'paid']);
    }

    public static function confirm(array $p): void
    {
        $order = OrderController::find($p['order_id']);
        if ($order['payment_status'] !== 'paid') {
            Database::update('orders', ['payment_status' => 'paid'], 'id = :id', ['id' => $order['id']]);
        }
        Response::json(['status' => 'ok', 'order_id' => (int) $order['id'], 'payment_status' => 'paid']);
    }

    public static function shopUpi(array $p): void
    {
        $shop = ShopController::find($p['shop_id']);
        Response::json(['upi_id' => $shop['upi_id'] ?? '', 'shop_name' => $shop['name']]);
    }

    public static function payPage(array $p): void
    {
        $order = Database::one('SELECT * FROM orders WHERE id = :id', ['id' => (int) $p['order_id']]);
        if (!$order) {
            Response::html("<html><body style='font-family:sans-serif;text-align:center;padding:60px'><h2>Order not found</h2></body></html>", 404);
        }
        $shop = Database::one('SELECT * FROM shops WHERE id = :id', ['id' => $order['shop_id']]);
        $shopName = $shop['name'] ?? 'Shop';
        $upiId = $shop['upi_id'] ?? '';
        $amount = (float) $order['total'];
        $alreadyPaid = $order['payment_status'] === 'paid';

        $pa = str_replace(' ', '', $upiId);
        $pn = str_replace(['&', '"'], ['&amp;', '&quot;'], $shopName);
        $orderId = (int) $order['id'];
        $amt = number_format($amount, 2, '.', '');
        $upiUrl = "upi://pay?pa=$pa&pn=$pn&am=$amt&cu=INR&tn=Order $orderId";

        $payDisplay = $alreadyPaid ? 'none' : 'block';
        $successDisplay = $alreadyPaid ? 'block' : 'none';

        $html = self::renderPayPage($pn, $amt, $orderId, $upiUrl, $payDisplay, $successDisplay);
        Response::html($html);
    }

    private static function assertOrderAccess(array $order, array $user): void
    {
        if ((int) $order['customer_id'] === (int) $user['id']) {
            return;
        }
        $shop = Database::one('SELECT * FROM shops WHERE id = :id', ['id' => $order['shop_id']]);
        if (!$shop || (int) $shop['owner_id'] !== (int) $user['id']) {
            throw new ApiException(403, 'Not your order');
        }
    }

    private static function renderPayPage(string $pn, string $amt, int $orderId, string $upiUrl, string $payDisplay, string $successDisplay): string
    {
        $upiAttr = htmlspecialchars($upiUrl, ENT_QUOTES);
        return <<<HTML
<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pay ₹$amt — $pn</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.card{background:#fff;border-radius:24px;padding:32px 28px;max-width:380px;width:100%;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,.1)}
.emoji{font-size:40px;margin-bottom:12px}
.shop{color:#888;font-size:14px;font-weight:500}
.amt{font-size:52px;font-weight:800;color:#5A5A40;margin:12px 0 4px;letter-spacing:-1px}
.orderid{color:#aaa;font-size:13px;margin-bottom:20px}
.pay-btn{display:block;width:100%;padding:18px;background:#5A5A40;color:#fff;border:none;border-radius:16px;font-size:18px;font-weight:700;cursor:pointer;text-decoration:none;transition:transform .15s}
.pay-btn:active{transform:scale(.97)}
.apps{display:flex;gap:8px;justify-content:center;margin:16px 0}
.apps span{font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px}
.pp{background:#5f259f20;color:#5f259f}.gp{background:#13733320;color:#137333}.pt{background:#00BAF220;color:#00BAF2}.any{background:#0001;color:#999}
.confirm-btn{display:none;width:100%;padding:18px;background:#16a34a;color:#fff;border:none;border-radius:16px;font-size:18px;font-weight:700;cursor:pointer;margin-top:16px;animation:fadeIn .3s}
.confirm-btn.show{display:block}
.hint{color:#bbb;font-size:12px;margin-top:12px}
.divider{height:1px;background:#eee;margin:20px 0}
.success-card{animation:scaleIn .4s}
.success-icon{width:88px;height:88px;background:#dcfce7;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:48px}
.success-amt{font-size:44px;font-weight:800;color:#16a34a;margin:8px 0}
.success-text{color:#16a34a;font-size:20px;font-weight:700;margin-bottom:8px}
.success-sub{color:#888;font-size:13px}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes scaleIn{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:scale(1)}}
.spinner{display:none;width:24px;height:24px;border:3px solid #fff4;border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;margin:0 auto}
.spinner.show{display:block}
@keyframes spin{to{transform:rotate(360deg)}}
</style></head>
<body>
<div class="card">
  <div id="payView" style="display:$payDisplay">
    <div class="emoji">🛒</div>
    <p class="shop">$pn</p>
    <p class="amt">₹$amt</p>
    <p class="orderid">Order #$orderId</p>
    <a href="$upiAttr" class="pay-btn" id="payBtn" onclick="onPayClick()">Pay with UPI</a>
    <div class="apps">
      <span class="pp">PhonePe</span><span class="gp">GPay</span><span class="pt">Paytm</span><span class="any">Any UPI</span>
    </div>
    <div class="divider"></div>
    <button class="confirm-btn" id="confirmBtn" onclick="confirmPay()">✓ Done — I've completed the payment</button>
    <div class="spinner" id="spinner"></div>
    <p class="hint" id="confirmHint" style="display:none">Tap above after you finish paying in your UPI app</p>
  </div>
  <div id="successView" style="display:$successDisplay" class="success-card">
    <div class="success-icon">✅</div>
    <p class="success-text">Payment Successful!</p>
    <p class="success-amt">₹$amt</p>
    <p class="success-sub">Order #$orderId · $pn</p>
    <p class="hint" style="margin-top:16px">You can close this page</p>
  </div>
</div>
<script>
let payClicked=false;
function onPayClick(){
  payClicked=true;
  setTimeout(()=>{
    document.getElementById('confirmBtn').classList.add('show');
    document.getElementById('confirmHint').style.display='block';
  },2000);
}
document.addEventListener('visibilitychange',()=>{
  if(payClicked&&document.visibilityState==='visible'){
    document.getElementById('confirmBtn').classList.add('show');
    document.getElementById('confirmHint').style.display='block';
  }
});
async function confirmPay(){
  const btn=document.getElementById('confirmBtn');
  const sp=document.getElementById('spinner');
  btn.style.display='none'; sp.classList.add('show');
  try{
    const r=await fetch('$orderId/confirm',{method:'POST',headers:{'Content-Type':'application/json'}});
    if(r.ok){
      document.getElementById('payView').style.display='none';
      document.getElementById('successView').style.display='block';
    } else {
      btn.style.display='block'; sp.classList.remove('show');
      alert('Something went wrong. Please try again.');
    }
  }catch(e){
    btn.style.display='block'; sp.classList.remove('show');
    alert('Network error. Please try again.');
  }
}
</script>
</body></html>
HTML;
    }
}
