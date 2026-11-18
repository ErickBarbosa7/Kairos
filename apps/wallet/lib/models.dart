class TenantInfo {
  TenantInfo({required this.id, required this.name, required this.logoUrl, required this.primaryColor});
  final String id, name, primaryColor;
  final String? logoUrl;
  factory TenantInfo.fromJson(Map<String, dynamic> j) =>
      TenantInfo(id: j['id'], name: j['name'], logoUrl: j['logoUrl'], primaryColor: j['primaryColor'] ?? '#B91C1C');
}

class NextReward {
  NextReward({required this.title, required this.pointsCost, required this.missing});
  final String title;
  final int pointsCost, missing;
  factory NextReward.fromJson(Map<String, dynamic> j) =>
      NextReward(title: j['title'], pointsCost: j['pointsCost'], missing: j['missing']);
}

class Balance {
  Balance({required this.tenant, required this.balance, required this.next, required this.affordable, required this.readyCoupons, this.campaigns = const []});
  final TenantInfo tenant;
  final int balance, affordable, readyCoupons;
  final List<String> campaigns;
  final NextReward? next;
  factory Balance.fromJson(Map<String, dynamic> j) => Balance(
        tenant: TenantInfo.fromJson(j['tenant']),
        balance: j['balance'],
        next: j['nextReward'] == null ? null : NextReward.fromJson(j['nextReward']),
        affordable: j['affordableRewards'] ?? 0,
        readyCoupons: j['readyCoupons'] ?? 0,
        campaigns: ((j['activeCampaigns'] ?? []) as List).map((e) => e['name'] as String).toList(),
      );
}

class Reward {
  Reward({required this.id, required this.title, required this.description, required this.imageUrl, required this.pointsCost});
  final String id, title;
  final String? description, imageUrl;
  final int pointsCost;
  factory Reward.fromJson(Map<String, dynamic> j) => Reward(
      id: j['id'], title: j['title'], description: j['description'], imageUrl: j['imageUrl'], pointsCost: j['pointsCost']);
}

class Coupon {
  Coupon({required this.id, required this.code, required this.title, required this.status, required this.validFrom, required this.expiresAt, required this.tenant});
  final String id, code, title, status;
  final DateTime validFrom, expiresAt;
  final TenantInfo tenant;
  bool get locked => status == 'PENDING' && validFrom.isAfter(DateTime.now());
  factory Coupon.fromJson(Map<String, dynamic> j) => Coupon(
        id: j['id'],
        code: j['code'],
        title: j['rewardTitle'],
        status: j['status'],
        validFrom: DateTime.parse(j['validFrom']).toLocal(),
        expiresAt: DateTime.parse(j['expiresAt']).toLocal(),
        tenant: TenantInfo.fromJson(j['tenant']),
      );
}

class ClaimResult {
  ClaimResult({required this.points, required this.balance, required this.tenantId, required this.tenantName, this.rewardTitle, this.rewardImage, this.couponCode, this.validFrom, this.expiresAt});
  final int points, balance;
  final String tenantId, tenantName;
  final String? rewardTitle, rewardImage, couponCode;
  final DateTime? validFrom, expiresAt;
  factory ClaimResult.fromJson(Map<String, dynamic> j) {
    final reward = j['reward'] as Map<String, dynamic>?;
    final coupon = j['coupon'] as Map<String, dynamic>?;
    return ClaimResult(
      points: j['pointsAwarded'],
      balance: j['balance'],
      tenantId: j['tenant']['id'],
      tenantName: j['tenant']['name'],
      rewardTitle: reward?['title'],
      rewardImage: reward?['imageUrl'],
      couponCode: coupon?['code'],
      validFrom: coupon == null ? null : DateTime.parse(coupon['validFrom']).toLocal(),
      expiresAt: coupon == null ? null : DateTime.parse(coupon['expiresAt']).toLocal(),
    );
  }
}

/// Quien usa la Wallet: invitado (sin correo) o cuenta.
class Me {
  Me({required this.isGuest, this.email, this.displayName});
  final bool isGuest;
  final String? email, displayName;
  factory Me.fromJson(Map<String, dynamic> j) =>
      Me(isGuest: j['isGuest'] as bool, email: j['email'] as String?, displayName: j['displayName'] as String?);
}

class NearbyReward {
  NearbyReward({required this.title, required this.pointsCost});
  final String title;
  final int pointsCost;
  factory NearbyReward.fromJson(Map<String, dynamic> j) => NearbyReward(title: j['title'], pointsCost: j['pointsCost']);
}

/// Sucursal suscrita a Kairos cerca del cliente.
class NearbyStore {
  NearbyStore({required this.storeId, required this.name, required this.storeName, required this.address, required this.logoUrl, required this.primaryColor, required this.distanceKm, required this.rewards});
  final String storeId, name, storeName, primaryColor;
  final String? address, logoUrl;
  final double distanceKm;
  final List<NearbyReward> rewards;
  factory NearbyStore.fromJson(Map<String, dynamic> j) => NearbyStore(
        storeId: j['storeId'],
        name: j['name'],
        storeName: j['storeName'],
        address: j['address'],
        logoUrl: j['logoUrl'],
        primaryColor: j['primaryColor'] ?? '#0F766E',
        distanceKm: (j['distanceKm'] as num).toDouble(),
        rewards: ((j['rewards'] ?? []) as List).map((e) => NearbyReward.fromJson(e)).toList(),
      );
}
