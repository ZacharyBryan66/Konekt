// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, ebool, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title ChainConfess - 匿名告白平台（FHEVM）
/// @notice 文本本身不做明文存储，使用 bytes/IPFS CID 表示密文载体；同时利用 FHE 存储部分元信息与计数
contract ChainConfess is SepoliaConfig {
    struct Confession {
        uint256 id;
        address sender;
        // 存储加密消息的载体（前端可放置对称密文或 IPFS CID bytes）
        bytes encryptedMessage;
        // 指定接收者；0x0 代表公开
        address receiver;
        uint256 timestamp;
        // 点赞计数使用 FHE 存储为 euint32
        euint32 likes;
        // 公开标记（FHE 布尔），便于做隐私安全的链上判断
        ebool isPublic;
        // 私密告白的“解锁次数”（FHE），仅在 receiver 解密成功时递增
        euint32 unlocks;
    }

    // confessionId => Confession
    mapping(uint256 => Confession) private _confessions;
    uint256 private _nextId = 1;

    // 去重点赞：confessionId => (user => bool)
    mapping(uint256 => mapping(address => bool)) private _liked;

    event ConfessionPosted(uint256 indexed id, address indexed sender, address indexed receiver, bool isPublic);
    event ConfessionLiked(uint256 indexed id, address indexed user);
    event ConfessionUnlocked(uint256 indexed id, address indexed receiver);

    /// @notice 发布告白
    /// @param encryptedMessage 前端生成的密文载体（bytes/IPFS CID）
    /// @param receiver 指定接收者；0x0 代表公开
    /// @param isPublicInput 外部加密布尔（公开/私密）
    /// @param proof 外部输入证明
    function postConfession(
        bytes calldata encryptedMessage,
        address receiver,
        externalEbool isPublicInput,
        bytes calldata proof
    ) external {
        // 将 externalEbool 转为内部 ebool
        ebool isPublic = FHE.fromExternal(isPublicInput, proof);

        uint256 id = _nextId++;
        Confession storage c = _confessions[id];
        c.id = id;
        c.sender = msg.sender;
        c.encryptedMessage = encryptedMessage;
        c.receiver = receiver;
        c.timestamp = block.timestamp;
        c.likes = FHE.asEuint32(0);
        c.unlocks = FHE.asEuint32(0);
        c.isPublic = isPublic;

        // 授权：公开帖子允许 anyone 解密 likes（演示），私密允许 receiver 与 sender 解密点赞数
        // 注意：这里只对计数/标志使用 FHE 解密授权，消息本体解密在前端完成。
        FHE.allowThis(c.likes);
        if (receiver == address(0)) {
            // 公开：不授予个人 ACL（公共可见的字段可通过 decryptPublic）
        } else {
            // 私密：接收者与发布者均可对 likes 做用户解密；unlocks 仅接收者
            FHE.allow(c.likes, receiver);
            FHE.allow(c.likes, msg.sender);
            FHE.allow(c.unlocks, receiver);
        }

        emit ConfessionPosted(id, msg.sender, receiver, receiver == address(0));
    }

    /// @notice 点赞公开或私密告白（每地址一次）
    function likeConfession(uint256 confessionId) external {
        Confession storage c = _confessions[confessionId];
        require(c.id != 0, "Not found");
        require(!_liked[confessionId][msg.sender], "Already liked");

        // FHE 累加 + 授权仍在存储时已设置
        c.likes = FHE.add(c.likes, FHE.asEuint32(1));
        _liked[confessionId][msg.sender] = true;

        // 链上不做明文解密，前端通过 Relayer SDK decryptPublic/userDecrypt 获取明文
        emit ConfessionLiked(confessionId, msg.sender);
    }

    /// @notice 仅接收者视角的“解锁”（前端完成消息解密后调用进行计数）
    function unlockConfession(uint256 confessionId) external {
        Confession storage c = _confessions[confessionId];
        require(c.id != 0, "Not found");
        require(c.receiver != address(0), "Public confession");
        require(msg.sender == c.receiver, "Not receiver");

        c.unlocks = FHE.add(c.unlocks, FHE.asEuint32(1));
        // 维持 ACL：合约自身与调用者对 unlocks 的访问权限
        FHE.allowThis(c.unlocks);
        FHE.allow(c.unlocks, msg.sender);
        emit ConfessionUnlocked(confessionId, msg.sender);
    }

    /// @notice 读取公开告白的基本信息（密文载体 + 明文元信息）
    function getConfession(uint256 confessionId)
        external
        view
        returns (
            uint256 id,
            address sender,
            bytes memory encryptedMessage,
            address receiver,
            uint256 timestamp,
            euint32 likes,
            ebool isPublic,
            euint32 unlocks
        )
    {
        Confession storage c = _confessions[confessionId];
        require(c.id != 0, "Not found");
        return (c.id, c.sender, c.encryptedMessage, c.receiver, c.timestamp, c.likes, c.isPublic, c.unlocks);
    }

    /// @notice 获取公开告白 ID 列表（演示：简单线性扫描，小规模可用；生产需事件或分页）
    function getAllPublicConfessions() external view returns (uint256[] memory ids) {
        uint256 total = _nextId - 1;
        uint256 count;
        for (uint256 i = 1; i <= total; i++) {
            Confession storage c = _confessions[i];
            if (c.id != 0 && c.receiver == address(0)) {
                count++;
            }
        }
        ids = new uint256[](count);
        uint256 idx;
        for (uint256 i2 = 1; i2 <= total; i2++) {
            Confession storage c2 = _confessions[i2];
            if (c2.id != 0 && c2.receiver == address(0)) {
                ids[idx++] = i2;
            }
        }
    }

    /// @notice 获取与某地址相关的告白（我发出的 + 我被告白的）
    function getMyConfessions(address user) external view returns (uint256[] memory ids) {
        uint256 total = _nextId - 1;
        uint256 count;
        for (uint256 i = 1; i <= total; i++) {
            Confession storage c = _confessions[i];
            if (c.id != 0 && (c.sender == user || c.receiver == user)) {
                count++;
            }
        }
        ids = new uint256[](count);
        uint256 idx;
        for (uint256 i2 = 1; i2 <= total; i2++) {
            Confession storage c2 = _confessions[i2];
            if (c2.id != 0 && (c2.sender == user || c2.receiver == user)) {
                ids[idx++] = i2;
            }
        }
    }

    /// @notice 简化 Top：不做链上排序，直接返回前 limit 个公开告白 ID（小规模/demo 用）
    function getTopConfessions(uint256 limit) external view returns (uint256[] memory ids) {
        uint256[] memory pubs = this.getAllPublicConfessions();
        if (limit == 0 || limit > pubs.length) limit = pubs.length;
        ids = new uint256[](limit);
        for (uint256 i = 0; i < limit; i++) {
            ids[i] = pubs[i];
        }
    }
}


