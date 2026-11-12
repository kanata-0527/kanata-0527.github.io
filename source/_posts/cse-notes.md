---
title: CSE 课程笔记
date: 2026-11-12 12:00:00
slug: cse-notes
pinned: 1
categories:
  - 本科课程
  - CSE
tags:
  - 课程笔记
  - 计算机系统工程
math: true
mermaid: true
description: 从本地文件系统、RPC 和分布式文件系统，到一致性、事务、共识与网络。
---

## inode-fs
- 20260917
file: has a name; duration (not cleaned when computer is off)

file system 对下 disk driver 管理，对上提供 fd...

file system provides api: OPEN, READ, WRITE, APPEND...

file system 的实现：UNIX FS version 6: 7 Levels
**L1:** block layer. trade-off between block size and number of blocks: efficiency vs. utilization.
- super block: contains metadata about the file system, including the number of blocks, free blocks, and other information.

**L2:** file layer. 记录每个file的blocks。record index node (inode)：一个新的数据结构:（inode大小是固定的，大约1kB）
```
struct inode 
    int block_num[N]
    int size
```
还有多级inode。
总之inode记录了文件的block信息和文件大小，几乎是文件所有的信息

**L3:** inode Number layer. 用 inode table 这个 table 来存储所有的inode

**L4:** File Name Layer. filename mapping inode number. 通过directory 是一个特殊的 file，里面存储了 filename 和 inode number 的映射关系。

**L5:** path name layer. inode 有一个 reference counter，记录了有多少个 filename 指向这个 inode。path name layer 通过 reference counter 来管理文件的删除和重命名。
Link：两个 filename 指向同一个 inode，reference counter +1; unlink：删除一个 filename，reference counter -1; 当 reference counter = 0 时，inode 可以被删除。
'.' and '..' 是特殊的 filename，'.' 指向当前目录，'..' 指向父目录。

**Renaming：** 编辑一个文件时，1. unlink(to_name), 2. link(to_name, from_name), 3. unlink(from_name). 但如果在1和2之间，系统 crash 了，那么文件就丢失了。
解决方案？

**L6:** Absolute Path Name Layer. 通过绝对路径来访问文件。绝对路径是从根目录(最早的，没有name的目录，/)开始的完整路径。

![alt text](../../assets/cse-notes/2be9dc2d52e7.png)

找一个文件： inode number -> inode -> block number -> block -> inode number -> inode -> ... -> block number -> block

**L7:** Symbolic Link Layer(soft link). 为了跨文件系统访问文件，提供了一个新的数据结构：symbolic link。symbolic link 是一个特殊的 file，里面存储了另一个 file 的绝对路径。mySoftLink 链接 myFile 的方式是 by filename；而 myHardLink 链接 myFile 的方式是 by inode number，也就是指向同一个 inode。
例如，如果一个 `/CSE` 目录 softLink 指向 `/CSE-2026/programs`，那么运行： `cd /CSE` + `cd ..`，bash 默认会保持用户输入时看到的逻辑路径，因此会返回 `/CSE`，而不是 `/CSE-2026`。如果输入 `cd -P ..`，bash 会返回 `/CSE-2026`，这代表着直接访问物理路径。

directory size is small, 因为它实际上只是文件索引表。

## api-fs

`file meta-data --inode：` 返回 inode 里面的： userid, groupid, size, block_num, reference counter, access time, modify time, change time... 尤其是 access time, modify time, change time 这三个时间戳。

**file descriptor：** 每个 process starts with 3 file descriptors: stdin(fd=0), stdout(fd=1), stderr(fd=2)。因此打开文件时，使用的 fd 是当前所有可用的 fd 中最小的一个。
fd 存在的意义：fd table 连接 file table，这个 file table 的每个表项： inode num + file cursor(file offset) + refcnt。 file cursor 是一个指针，指向当前文件的读写位置。

**WRITE:** 需要注意的是，除了 write new data，还有可能 allocate new block & update inode's size and mtime. 因此，update block bitmap, write new data, update inode(size and pointer)，用这个顺序可以保证 crash consistency。因为 inode 里面的 size 和 pointer 是文件的元数据，inode 的更新是原子操作。

## remote-procedure-call(RPC) 

RPC 是一种远程过程调用机制，它允许程序在不同的计算机上调用函数，就像调用本地函数一样。
why RPC vs. socket: 为什么不直接用 socket？ RPC 的实现通常依赖于 socket，但它提供了更高层次的抽象，也就是隐藏了网络通信的细节。

**stub:** 整套系统的划分：client -> client stub -> network -> server stub -> server。其中，client stub 完成：编码参数、发送网络请求、接收 response、解码 response、return 给调用者等操作；相应的 server stub 完成：接收请求、解码参数、调用本地函数、编码响应、发送 response 等操作。

### request 
PRC 发送的 request 包括：xid, call/reply, RPC version, program number, program version, procedure number, authentication, arguments。
response 包括：xid, call/reply, accepted/rejected, auth stuff, success/failure, results。

xid 用于匹配 request 和 response，由于多个线程并发请求可能会有 response 乱序返回的情况，因此需要 xid 来标识每个请求；此外，xid 还可以防止重复请求的处理。

### 跨机器传参
传递指针时，不同机器的内存地址不同，因此不能直接传递指针；传递整数时，可能存在大小端问题...
因此，我们采用：marshal 和 unmarshal 的方式来传递参数，实际就是 serialize/encode 和 deserialize/decode 的过程：


`程序对象 -> marshal -> byte stream -> unmarshal -> 程序对象`


在这个过程中，需要保证 evolvability，也就是新旧代码/数据结构的兼容性。
json/xml 是常用的序列化格式，常用 binary format，双方先约定一个 **schema** ，然后双方都按照这个 schema 来序列化和反序列化数据。例如，将 userName 替换成 tag1，只需要传递 tag1，而不需要传递 userName。
除了上述的 binaryProtocal, CompactProtocal 还可以进行进一步的优化，例如，把 field tag delta + tag 压缩进同一 byte，或者把 variable-length integer 压缩进更少 byte。
此外，我们可以知道，schema 也便于 evolvability，因为我们可以在不破坏原有 schema 的情况下，添加新的字段。

RPC 也需要隐藏 transport，也就是可以在不同的 transport 上运行，例如 TCP, UDP, RDMA 等。

### RPC 遇到 failure
由于 RPC 可能遇到多种情况下的 failure，且无法定位具体原因，因此给出解决方案，用 RPC semanctics 来描述 RPC 的行为：
- at-least-once：可能会执行多次，客户端需要处理重复请求的情况。
- at-most-once：每个 RPC 携带一个唯一的 xid，server 记录已经处理过的 xid，收到重复请求就不再调用 handler，而是直接返回上次的 reply，这个 reply 参考 reply cache。

    **Idempotence（幂等）：** f 执行多次的效果 = f 执行一次的效果。例如，扫地/按电梯就是幂等的操作，而转账/买票就不是幂等的操作。又如，read_only 的操作是幂等的，而 write 操作不是幂等的。

- exactly-once：理想的 RPC semanctics 是 exactly-once，其要求是 retry + 持久性地记忆 unique xid + stored reply。也就是 server 需要持久化地存储已经处理过的 xid 和 reply，这样即使 server crash 了，也可以在重启后继续处理重复请求。

## distributed file system (DFS)

### NFS(Network File System)

如何提供一个本机可以使用其他机器的文件系统的能力？NFS 提供了这个能力。
远程 open() 不使用 fd，而是采用 stateless 的方式，每次请求都包含完整的参数信息，file cursor 由 client 保存和维护，也就是 RPC 携带 fh（file handle） 和 offset。
- fh 就是 file handle = inode number + generation number，inode number 是唯一的，用于定位文件，generation number 用于区分 inode reuse，维持文件一致性。

**NFS 的性能问题：** 由于网络延迟，NFS 的性能可能会受到影响。为了解决这个问题，NFS 引入了 client-side caching 机制。
然而，caching 有 concurrency 问题，例如，client A 和 client B 都缓存了同一个文件的内容，如果 client A 修改了文件的内容，而 client B 仍然使用缓存的内容，那么就会出现数据不一致的问题。
NFS 使用 close-to-open consistency 来解决这个问题，也就是在文件被关闭后，其他 client 才能看到修改后的内容。
缓存可以用时间戳判断失效情况。

### GFS(Google File System)

基于大量机器和海量数据的需求，GFS 提供了一个高性能、高可用的分布式文件系统。
`GFS = 1 Master + N chunkservers.`
GFS 将文件划分为固定大小的 chunk（通常为 64MB），每个 chunk 都有一个唯一的 chunk handle。为什么 chunk size 这么大？因为大文件的访问模式通常是顺序访问，chunk size 大可以减少 metadata 的开销，提高吞吐量。master 负责管理 metadata，包括文件名到 chunk handle 的映射关系，以及 chunk handle 到 chunkserver 的映射关系。

replica：副本

**GFS 的读流程：** client 读 file F, offset = x，client 先计算 chunk index = x / chunk size，然后向 master 请求 F 的 chunk handle 和 replica locations，master 返回后，client 直接向 chunkserver 发送 read 请求，chunkserver 返回数据。
**GFS 的写问题：** 如果多个 replica 同时写同一个 chunk，如果顺序不同，那么最终的 chunk 内容可能不同。GFS 采用 primary-secondary replication 的方式来解决这个问题，也就是选举一个 primary replica，其他 replica 为 secondary，所有顺序由 primary replica 决定，secondary replica 按照 primary replica 的顺序进行写操作。
**GFS 的两个phase：** phase1(data flow)：client 将数据发送给所有 replica; phase2(control flow)：client 向 primary replica 发送 commit 请求，primary 决定顺序并将 commit 请求发送给 secondary replica，secondary replica 按照 primary replica 的顺序进行写操作。

### 3FS(The Fire-Flyer File System)

在 AI workload的多文件、随机访问、高速 RDMA 网络的需求下，3FS 提供了一个优化和一些变化：
1. GFS 的 Master 同时负责 metadata 管理和状态维护，而 3FS 将 metadata service 做成 stateless service，多个 meta service 全都调用同一个 distributed transactional KV store 来维护 metadata 的一致性。meta service 不保存 metadata（也就是 stateless 的），后者放在 KV store 中。transactional KV store 的事务性是全或无的，保证了原子性和 metadata 的一致性。
2. 3FS 只记录“写打开”的文件，也就是只记录写操作的文件，而不记录读操作的文件。这样可以减少 metadata 的开销，提高性能。
3. lookup chunk：由于 random reads & 很多小文件，chunk ID = (inode ID, chunk index)，client 不再询问 master，而是自行通过 chunkID 计算 chunk 的位置。
4. locality-oblivious：由于 AI workload 的随机访问模式，3FS 不再考虑 locality，而是通过 RDMA 来提高性能。Disaggregated 表⽰计算与存储分离：GPU 节点和存储节点是不同机器。网络速度快，因此 client 不再需要在物理位置上靠近 storage machine。
此外，使用 FUSE 让用户态程序可以直接访问文件系统，而不需要内核态的支持。也就是用户态实现的文件系统看起来就像内核态实现的普通 Linux 文件系统一样。

然而，由于现代硬件（SSD/RDMA）速度的提升，FUSE software path 自己成为瓶颈，因此，3FS 提供了 Native API：
open 仍然是通过 FUSE 来实现的，而性能最敏感的 read/write 操作则通过 shared-memory ring: application -> shared memory -> 3FS userspace -> RDMA -> storage services。

## Consistency when executing operations concurrently

**一个以 GFS 为例的problem:** client 读文件时，可能会读到不同的 data：这是因为 GFS 往往从一个 replica 读数据（一般是最近的），然而，某些 failed write 也可能会作用于不同的 replica，因此不能保证所有 failed 情况下都有一致的结果。

因此，我们需要知道：什么是一致性模型，为什么需要它，如何定义和使用它；不同时间戳如何帮助实现收敛；线性⼀致性⼜能提供什么额外保证。

### 集中式方案 
以最简单的 chat app 为例（具体情境是微信引用聊天记录），一台中心服务器保存所有聊天状态，客户端通过 RPC 执行 update & read。服务器只有⼀个并按抵达顺序追加；客⼾端必须收到上⼀次 RPC 的 ack，才发送下⼀次RPC。因此，引用不会跑到被引用的内容前面。
然而，关于集中式方案的几个缺点：
1. (performance) long update time，用户等待请求传输、服务器处理和回复传输的过程，等待时间长；
2. (performance) slow read, and slower as history grows，每次 read() 返回全部聊天历史，历史越⻓，需要传输的数据越多，读取时间和带宽成本越⾼；
3. (Reliability) cannot work offline，断⽹不能查看过去的聊天记录，甚⾄编辑或发送待同步消息；
4. (Reliability) cannot deal with server failures，单一服务器宕机后，所有用户均失去服务。

### 复制和缓存方案
每个设备为一个副本(replica)，即：以前只有一份状态，大家访问它。现在有多份状态，各设备可以独立操作。
已有设备会各自保存一份聊天记录缓存以支持离线查看，各个设备也可以在本地执行 update & read。总之，复制和缓存的方案可以提高性能和可靠性，使某些本地功能可以离线完成。
然而，只读写本地缓存的方案会带来一致性问题，因此对于本地副本的读写方案有：
1. 把更新发给全部副本，等待全部副本返回 ack 后才返回给用户；
2. 可以在一些副本确认 ack 后返回，为了保证某些副本的缺失不会影响等待时间，对于缺失的副本，可以在之后的某个时间点再发送更新；通过周期性同步修复落后的副本，例如10s的周期性心跳同步，或是推送更新的方式；

同步排序和冲突的问题：
1. 同步时不同消息的顺序可能不同；
2. 合并时可能出现冲突，因此要采用“过滤重复项，再增加新项”的方式来合并不同副本的消息，即保留更新+避免重复；
3. 合并后应该保留的顺序也会有问题，对不同副本看到的内容顺序不同，可能会导致合并后的顺序不一致。

### 一致性模型
应⽤开发者通常希望系统像⼀台正确串⾏处理请求的服务器⼀样容易理解，但同时⼜想要复制带来的性能、离线能⼒和容错。这些⽬标会限制彼此，尤其在⽹络延迟和故障出现时。
因此，在不同一致性模型中有不同的trade-off，开发者需要根据应用的需求选择合适的一致性模型。

**一致性模型的定义：** ⼀致性模型规定了：不同观察者能看到哪些更新、更新以什么表⾯顺序出现，以及哪些读取结果是合法的。它是系统与应⽤之间的⾏为约定。
**一致性模型的谱系：** 从左向右，worse performance/fault tolerance, easier to use：eventual, causal, sequential, linearizable, strict...
基于不同的系统目标和应用需求，选择不同的一致性模型。

以我们这节课的 chatApp 为例，两个目标是：1. 尽可能持续可用，能够读到消息；2. 读取最终正确，即每台设备最终得到相同数据。

#### eventual consistency
eventual consistency 允许副本暂时不同，但要求在不再产⽣新更新、通信恢复并完成传播后，各副本最终会收敛到相同的状态。

这里的“最终”没有规定固定的时间上界，也不是每次 read 都能看到整个系统最新的 data。一个 replica 在离线时只能读到它已经收到的更新，之后需要通过 sync 补齐。对于 chat history，最终相同的是合并后的整个 list，而不是只保留最后一条 message。

**eventual consistency 的实现：** write locally, then sync to others。read 直接返回本地副本，write 先修改本地副本并返回，然后在后台 sync() 给其他 replica。
这样，本地 write 可以不等待 network RTT，也就是 0 RTT。
sync 可以是 peer-to-peer，也可以通过一个 server 中转。采用 at-least-once RPC 时，同一个 update 可能重复到达，因此要给 update 一个唯一 ID，并按 ID 去重，避免把同一条消息 append 多次。

#### 同步排序

**sync 的问题：** 同步完相同的 updates，不一定就有相同的 state。例如，R1 先在本地 append X，R2 先在本地 append Y，之后交换更新，会导致虽然两个 replica 都有 X 和 Y，但 list 的顺序不同。因此，sync 解决了“收到哪些更新”，还要解决“以什么顺序执行更新”。

**deterministic sort（确定性排序）：** 把 updates 保存在 log 中；sync 时合并 log，过滤重复操作，然后 **按一个共同的 sort key 排序** ，clear state，再按这个顺序 redo 所有 updates。
同一组 updates 在所有机器上排序成同一顺序，而且 update 的执行规则相同，就能得到相同 state。这里 log 存的是操作历史，state 是执行这份历史得到的结果。迟到的 update 可能应该排在已有 update 前面，因此不能总是只 append 到当前 state 的末尾。

然而，deterministic 只是保证“大家相同”，不保证“顺序合理”。因此，需要仔细选择 sort key，主要目的是让排序结果唯⼀，保留必须遵守的依赖关系。

**使用 physical time 作为 sort key：** 一个直觉是把本机的 getTimeOfDay() 作为 timestamp，时间小的 update 排在前面。但这有两个问题：
1. 时间读数有精度限制，两个 update 可能得到同一个 T。如果只按 T 排序，同 key 的操作仍可能保留各自的 arrival order，导致结果不同。
2. 不同机器的 clock 是独立运行的，可能有 offset 和 drift，跨设备的时间读数不能直接保证真实先后。

**使用 total order（全序）作为 sort key：** 对任意两个不同操作，都能按照共同规则确定先后。为了处理相同的 T，可以用 `<T, node ID>` 作为 sort key：先比较 T，相同时再比较 node ID。例如 `<100, R1> < <100, R2>`，所有 replica 都采用相同的 node ID 顺序，就能打破平局。

但 node ID 只解决 tie-breaking，不能解决 clock 不同步。并且，如果同一 node 在同一个物理时间刻度内产生多条 update，`<T, node ID>` 仍可能重复，还需要 local sequence number 等信息区分操作。

#### causal ordering 因果排序

我们真正希望保留的是 file -> ref(file) 这样的依赖/因果关系：只有先看到 file，才会产生对它的引用。对于两条完全独立的消息，则不一定需要知道哪条在物理时间上先发生。

**causal relationship（因果关系）：** 用 `X -> Y` 表示 X happens before Y，规则有：
1. 在同一个顺序执行的 process 中，X 发生在 Y 前面，则 `X -> Y`。
2. 一条 message 的 send 发生在它的 receive 之前。通信把一个 process 的依赖传给另一个 process，因此收到 X 的信息后再产生 Y，可以形成 `X -> Y`。
3. 具有传递性：`X -> Z` 且 `Z -> Y`，那么 `X -> Y`。

**concurrent events：** 如果既没有 `X -> Y`，也没有 `Y -> X`，则 X、Y 是并发事件。这里的并发是“没有因果先后”，不要求两件事在现实中恰好同一秒发生。

**causal consistency：** 要让观察者保留有因果关系的 updates 的顺序；没有因果关系的 concurrent updates，则不一定要求各个观察者采用同一个顺序。因此，causal order 本身是 partial order（偏序），而不是给所有 events 都规定唯一的先后。
我们的 sort key 至少要满足：如果 `X -> Y`，那么 X 的 timestamp 小于 Y。因此，可以把 timestamp 附着在通信的 message 中，收到 message 后，更新本地 timestamp，再产生新的 message。

#### Lamport clock

**Lamport clock：** 一种 logical clock，为每个进程维护一个递增的 logical counter，为本地 events 分配 timestamp。

**Lamport clock algorithm:**
```text
initial: T = 0

local event / send event:
    T = T + 1
    event timestamp = T
    send 时把 T 附在 message 中

receive a message with timestamp T_remote:
    T = max(T, T_remote) + 1
    receive event timestamp = T
```

#### 接龙与 concurrent updates

并发事件是一个人为规定的全序关系，实际上也可以保持为不可比较，具体取决于业务逻辑。

**接龙的例子：** 假设“第一个接龙的人拿奖金”，或者两个用户都从只有17人的名单中把自己 append 成第18人。sync 后，两条 update 都可以保留，但必须决定谁是18、谁是19；如果之前已经告诉用户“你是18”，后来又重排，用户就无法把临时结果当成最终结果。因此，有两条解决路线：
1. 明确告诉 application：这两个 events 是 incomparable，出现 conflict，由 application 决定如何处理，例如重新接龙。缺点是每个 application 都要自己处理冲突，而且无法自动保证真实先报名的人获胜。
2. 采用更强的一致性模型，先协调出一个共同、符合模型约束的顺序，再暴露正式结果，而不是先让各个 replica 独立确定结果、之后重排。

由于 lamport clock 只记录因果先后，无法区分 concurrent events，因此其提供全序关系是全部事件的全序，但对于 **任意两个事件** 的先后比较，可能有三种结果：明确的>，明确的<，以及无法比较的并行事件。
由此，我们引入 vector clock。

#### vector clock

**vector clock（向量时钟）：** 每个进程保存一个 N 维向量 V，N 是参与进程数，自己的项表示自己的 logical progress，其他项表示已经知道的其他 node 的 progress；它记录的是因果历史，而不是 N 台机器的物理时间。

本地 event 只把自己的 entry 加1；send 时附上当前向量；receive 时和收到的向量逐项取 max，再把自己的 entry 加1：

```text
node i 保存 V[0..N-1]，initial 全为0

local event / send event:
    V[i] += 1
    event timestamp = copy(V)

receive a message with vector V_remote:
    for each j:
        V[j] = max(V[j], V_remote[j])
    V[i] += 1
    receive event timestamp = copy(V)
```

**向量比较：** 对于 X 和 Y 两个事件的比较，`V(X) < V(Y)` 要求所有 entry 都满足 `V(X)[i] <= V(Y)[i]`，而且至少有一个 entry 严格小于。例如，初始都是 `[0,0]`，R1 独立产生 X -> `[1,0]`，R2 独立产生 Y -> `[0,1]`。第一项 X>Y，第二项 X<Y，谁都没有逐项支配对方，因此 incomparable，X 和 Y 是 concurrent 的。

**PPT 的合并例子：** R1 已经产生 X，当前 `[1,0]`；收到 R2 的 Y，timestamp=`[0,1]`：

```text
R1 current:          [1,0]
received Y:          [0,1]
entry-wise max:      [1,1]    # 更新 X 为 max([1,0],[0,1])
receive event:       [2,1]    # R1 自己的 entry +1
then create ref(Y):  [3,1]    # 再发生一次本地 event
```

Y 的 `[0,1] < ref(Y)` 的 `[3,1]`，因此可以确定 `Y -> ref(Y)`。但 X 和 Y 当初的 timestamps 仍是 `[1,0]` 和 `[0,1]`，仍然不可比较；后来的 sync 不会反过来把原本独立的 X、Y 变成有因果先后的 events。

对于接龙问题，vector clock 可以用于判断是否有冲突和风险，但无法直接解决谁先谁后的问题，而是交给应用层去处理。
因此，解决接龙问题的另一个途径是采用更强的一致性模型，让系统提供一个共同的、符合模型约束的顺序。

### 强一致性模型

**strong consistency 的视角：** 虽然物理上有多个 replica，但对 application 看起来只有 one logical copy，所有 read/write 的效果可以解释为同一个合法的 serial execution。也就是操作实际可以并发执行，但对外返回的结果必须能放进一条共同的串行历史。
例如，两次 append 和一次 read，结果可以解释为 `append A -> append B -> read [A,B]`。不同时间的 read 可以看到这条共同历史的不同阶段，不要求每次都返回相同内容；但是不能各自给出互相矛盾、无法放进共同历史的结果。

然而，“存在一个共同的 serial order”还需要由这个模型继续规定：这个 order 应该遵守什么先后关系？按用户的 issue time，按 server 的 arrival time，还是按一个操作完成后另一个操作才发起的顺序？不同的要求产生不同 consistency model。也就是为系统的顺序判定增加一个约束条件和依据。

#### strict consistency

**strict consistency：** 按全局 issue time 对操作排序，也就是谁先发起，谁在共同序列中排前面。对于接龙，issue time 就是用户按下按钮的时刻；如果 Alice 先按、Bob 后按，理想结果是 Alice 在前，而不受网络快慢影响。

**集中式 server 也不一定做到strict：** 受到网络等多种因素的影响，不同用户发送的信息到达 server 的顺序不一定等同于严格实验顺序；而单一 server 只知道 arrival order，直接按 arrival 处理，就可能得到与 issue order 相反的 arrival order 的结果。we have 2 challenges：
1. **unsynchronized clocks：** request 携带 getTimeOfDay() 也不够，因为不同设备的 clock 不同步。
2. **unbounded wait：** 即使假设 clock 完全同步，server 收到 timestamp=7 的 B，也不知道 timestamp=5 的 A 是否还在路上，更不知道还要等多少个、更早的 request。没有 network delay 的已知上界时，有限等待不能证明已经收到所有更早请求；丢包和 failure 还会让等待更难结束。

因此，strict consistency is strong but impractical。系统往往只能接受按照 arrival order 排序的结果，而不是严格的 issue order。

#### linearizability

对于两种类型的事件，我们有不同的处理方式。

**linearizability（线性一致性）：** 系统仍然像一个 logical copy，所有操作有合法共同的 serial order；此外，需要保留全局的 completion-to-issuing order。如果 A 已经完成，B 才发起，那么 A 必须在共同顺序中位于 B 之前。

```text
A: issue -------- complete
B:                         issue -------- complete

A complete before B issue ==> serial order 中 A 在 B 前面
```

**overlapping operations：** 如果 A、B 的执行区间重叠，A 开始时 B 可能没开始，但 B 开始时 A 还没结束，那么模型允许选 `A -> B` 或 `B -> A`，只要整个执行结果能满足一个共同的合法顺序。

```text
A: issue ---------------- complete
B:        issue ---------------- complete

两者 overlap；不强制按 issue time 排序
```

因此，Alice 先按按钮、Bob 后按按钮，如果 Alice 的操作还没有完成，Bob 就开始了，那么 linearizability 仍可能把 Bob 排在前面。它不保证所有 concurrent 报名中真实先点击的人获奖；但如果 Alice 已经报名成功并收到完成回复，Bob 才开始报名，就必须把 Alice 放在前面。

**read 的要求：** 一次 write 已完成，之后才开始的 read 必须反映它在共同历史中的效果。例如 append B 已经完成，之后读聊天 list 不能返回一个完全缺少 B 的旧 list。对于变量 x，如果 `write(x,2)` 已完成且没有其他 write，后续 read 必须返回2；如果期间又有其他 write，则按共同历史中的相应新状态返回，而不是永远返回2。
于是，我们可以把每个操作理解为在 issue 与 complete 之间的某个时刻瞬间生效，这个时刻叫 **linearization point**。这样，overlap 的操作可以由系统选择生效先后，non-overlapping 的操作却不能反过来。

集中式 server 在正确串行处理 read/write、完成处理后再回复的前提下，可以提供这种 completion-to-issuing 顺序；它提供的是 linearizability，linearizability 也可以在 distributed system 中实现，所以 strong consistency 不等于必须只用一台机器。

#### primary-backup replication

**实现目标：** client 的 read/write 可以先发送给任意 replica，但最终结果要符合一个 logical copy 的共同历史。
一个错误的想法是：像 eventual consistency 一样，每个 replica 先确认本地 write，再在 sync 时重排。这样，不同用户可能已经看到无法放进同一个实时历史的结果；之后把最终 state 改成一样，也无法消除先前 read 已经返回的矛盾。

**one writer rule：** 解决方案是：由一个协调者决定 read/write order，再把顺序传播给其他 replica，writer 指一个排序来源，而不是真的只允许一个 client 写。

**primary-backup model：** 对每个 object 选一个 primary，其他 replica 为 backup。所有 read/write 都由 primary 协调；如果请求先发给 backup，backup 就 forward 到 primary。这里 primary 还要把 read 与正在进行的 write 放进共同顺序，例如不能在已经应该反映某次完成写入的 read 中返回旧值。

**in-order updates：** primary 的接收顺序可能受网络影响。因此，primary 给每条 update 一个递增的 **sequence number**，所有 replica 按 seq order 执行，如果 backup 收到的 seq 不连续，就要 pending 等待缺失的 seq，直到收到缺失的 update 才能继续执行。

**朴素 primary-backup 的缺点：**
1. (performance) 所有操作由 primary 协调，可能形成 bottleneck；write 还要等待 backup ack，多一次通信过程。
2. (reliability) 在这个没有 failover 的简单模型里，primary crash 后，其他 replica 无法自行继续决定正式顺序。
3. (reliability) 如果 write 要等待全部 backups，某个 backup crash 或断网，就可能使 write 无法完成，又回到前面“sync with all”的问题。

#### sequential consistency

为了优化 primary-backup 的 read，一个想法是直接让各个 replica 返回 local copy，减少与 primary 的通信。然而，这可能破坏 linearizability。

**一个反例：** 初始 x=1；primary 收到 `write(x,2)` 并 forward 给 backup；backup 已经应用2，但 primary 还没应用，从结果上看违反了 linearizable 原则：

```text
backup:  x=2 -> read R1 返回2，完成
primary: x=1 -> 在 R1 完成之后才开始 read R2，返回1
之后 primary 才应用 x=2，并完成原来的 write
```

我们将这个现象称为 **sequential consistency（顺序一致性）：** 所有操作仍然要能解释成同一个合法 serial execution，并保留每个 process 自己的 program order；但不要求不同 process 之间的 global real-time order。
如果 R1、R2 属于不同的 process，且没有其他 program-order 约束阻止重排，上面的结果可以解释成：`R2: read x=1 -> write x=2 -> R1: read x=2`。
这个抽象顺序与真实的 R1 完成后才发起 R2 相反，但 sequential consistency 不要求保留这段跨 process 的实时顺序，因此可以接受。

最后，关于不同谱系的讨论：eventual -> causal -> sequential -> linearizable -> strict，表示对观察结果的约束逐步增强。越强的要求，implementer 可采用的优化就越少。

## All or nothing atomicity consistency under failure
我们希望系统在 crash 或 failure 后，仍然能保证 atomicity，也就是要么完全执行，要么完全不执行。

我们之后的叙述用不变量定义正确性，也就是说，不变量的约束条件在 crash 前后都必须成立，才能保证 atomicity。
同时我们假设 fail stop，即 crash 后不再继续执行任何操作。

**朴素 bank 实现方案：** 把所有账户文件都记录在 bank 文件中，用 mmap 映射到内存，完成修改后，最后 fsync() 从 page cache 同步到 disk 上，通知用户完成。
因此，如果 crash 发生在 fsync() 之前，所有修改都在 page cache 中，disk 上的 bank 文件没有被修改；
但如果 crash 发生在 fsync() 的过程中，由于 fsync() 可能是分块写入，bank 文件可能只被部分修改，导致 disk 上的 bank 文件处于不一致状态。

**全或无的原子性的定义：** ⼀组操作在恢复后的效果必须是全部发⽣，或者完全没有发⽣。原⼦性把⼤量复杂故障位置压缩成两个业务情况：做了，或者没做。底层仍可能留下中间状态，只是恢复过程必须将它整理成其中⼀种完整结果，再对外提供服务。

### shadow copy
shadow copy 是一种实现全或无原子性的方案。它的基本思想是：在修改数据之前，先创建一个数据的副本（shadow copy），然后对副本进行修改。只有当所有修改完成并且验证通过后，把副本 rename 成原来的数据文件替换。
由此，可以处理 fcopy 过程中的 crash 情况，因为此时临时副本还没有被 rename，原始数据文件仍然保持不变，重启后可以清理掉临时副本。
但如果在 rename 的过程中 crash，从银行文件内容看没有问题，因为 bank 文件一定是完整的；然而，rename 本身可能会修改 dir，inode等 filesystem metadata，因此，应⽤内容合法，不代表⽂件系统的内部结构也⼀定合法。例如，如果在清理 inode 的 count 时 crash，inode 的 count 可能不正确，导致引用和文件不匹配的错误和资源泄露。
一种思路是：依赖 application clean up，即应用程序在重启后检查临时副本是否存在。这个思路有缺陷，我们应当依赖 filesystem 的恢复机制保证 crash consistency。

### filesystem 的 crash consistency
由于 shadow copy 只有在 rename 原⼦时才完整成⽴，因此我们将原子性问题进一步推到 filesystem 的要求上。

**journaling:** journaling 是一种实现 crash consistency 的方案。filesystem 在修改 disk 数据之前，先把修改操作记录在一个日志（journal）中，然后再执行实际的修改操作。顺序为：记录 changes -> 提交 journal -> 执行修改。几个case：
1. rename via journaling：流程为：将 inode 和新内容写入 journal -> 写入 COMMITED 标记 -> update data -> discard journal。因此，如果 crash 发生在 rename 中途，journal 中已经有完整的内容，便于恢复；
2. append to a file via journaling：journal 中会记录 append 的所有内容，包括 inode, pointer, block 的 allocate, data...

**完整 journal 的 cost：** 同一份文件先进入 journal，再写入 disk，增加了两次写入的开销；
因此，selective journal 只选择性记录一些 data，e.g. metadata，减少 journal 的开销。对于不同 data，提供了三种模式：
1. data = writeback，journal 只记录 metadata，如果 crash，保证 metadata 的恢复，不保证 data 的顺序恢复；
2. data = ordered，journal 只记录 metadata，但是在写入 journal 之前，先把 data 写入 disk，此时写入的 journal 中的 metadata 记录了 data 的顺序，因此可以保证 crash 后 data 的顺序恢复；
3. data = journal，journal 记录 metadata 和 data，保证 crash 后 data 的顺序恢复，但是增加了 journal 的开销。

**朴素 shadow copy 的限制：**
1. 同时间只有一条 operation 可以执行，除非增加并发控制机制，否则可能出现多个 operation 同时修改同一个文件；
2. 难以扩展到多 file/dir 的情况；
3. any small change requires a full copy of the file，开销大。

**将 journaling 推广为 logging：** shadow copy 在一个文件中 buffer updates，journaling 在一个 log 中 buffer updates，其思路是一致的。

**事务：** 事务是指一组全有或全无的操作，通过 begin() 和 commit() 来标记事务的开始和结束，中间包裹的都是原子性操作。
**commit point:** 提交点是系统从此保证事务完整效果会被保留的界线，也就是在此之后的内容都会被保留。

### redo-only logging 
1. 在开始时，用局部变量（在内存中）保存所有修改的内容（新值），不提前写入 disk 等持久位置；
2. 执行 log.append.sync()，把所有修改的内容写入 log，但是这个 log 也可能由 crash 导致不完整；
    - 我们如何知道 one log entry 是否完整？use a checksum，写⽇志时同时保存校验值，恢复时重新计算。若不匹配，就不能把该 entry 当作完整事务，因此跳过其效果。
3. 日志同步成功后，then update disk data，完成修改。
4. 此后，如果 crash 发生，恢复时只需要按顺序重放 log 中的完整 entry，重新执行修改操作即可。

redo-only logging 的 commit point 就是 log.append.sync() 成功的时刻。此时，所有修改都已经写入 log，之后的 crash 不会丢失这些修改。
幂等性很重要，因为 log 中的 entry 可能会被重复执行，因此每个 entry 的修改操作必须是幂等的，才能保证恢复后的结果正确。

redo-only logging 的缺点是：新值保存在内存中，修改过多数据时，可能会导致内存不足；日志持续增长，恢复时扫描开销大。

value log 和 operator log 的区别：value log 记录的是每个修改的 old value 和 new value，而 operator log 记录的是每个修改的操作，一个 trade-off 是：value log 占用空间大，但恢复时可以直接应用 new value，而且是幂等的；operator log 占用空间小，但恢复时需要重新执行操作，可能会有副作用。

### undo-redo logging
如果直接修改 disk 数据，且在 transaction 未提交时，可能会导致 crash 后，一部分数据写入，一部分数据没有写入。因此为了撤销未完成的修改，我们需要 log 能够 undo uncommited state。

日志在每次写入修改前，先保存每个值的 old value 和 new value，恢复时：
- 如果 crash 发生在 commit point 之前，说明事务未提交，需要 undo uncommited state；
- 如果 crash 发生在 commit point 之后，说明事务已经提交，需要 redo committed state.

redo-only logging 记录的是 log entry，每个 entry 记录整个 transaction 的修改内容；而 undo-redo logging 记录的是 log record，每个 record 记录一个修改操作。
在一个 log record 中，包含了：
- transaction ID
- pointer to the previous record Of the same transaction, chaining them into a list
- the record itself: file name， offset， old value， new value

2 Logging rules：1. 在正式 update 持久化状态前，先持久化日志，称为 **write-ahead logging(WAL)**；2. 在 commit point 时把 commit record 写入日志。

recovery rules：先从后往前扫描日志，undo uncommited state；再从前往后扫描日志，redo committed state。

### chekckpoint 与日志回收
log file keeps growing，如何找到一个合适的时机来回收日志？

**checkpoint的定义：** 用较紧凑的形式保存系统状态或恢复进度，让后续恢复不必从头扫描整个日志。
例如，truncate（裁断）可以不用重新执行恢复过程，将全部事务整理到一个状态；已提交但未落盘的数据位于 page cache 中，也就是实际上在内存中而不是在磁盘中（redo-only 只有这种情况），checkpoint 可以通过 flush page cache （刷新旧的状态和脏页）来把这些数据落盘，并裁剪无用日志。

- **redo-only 事务跨越检查点：** 未提交事务的新值仅存在于局部变量中，因此 checkpoint 不会把这些新值落盘；
- **undo-redo 事务跨越检查点：** 如果 undo-redo 事务仅完成一半，checkpoint 就刷新缓存，并裁剪日志，会导致未提交事务的 old value 被丢弃，之后 crash 时无法 undo uncommited state。
  - 一个朴素的 solution：暂停所有事务，等待所有事务完成后再 checkpoint；也就是设置一个 stall 的 barrier，阻止新的事务开始，等待所有事务完成后完成 checkpoint 的 flush & discard，再允许新的事务开始。缺点是暂停所有事务会影响性能，且如果某些事务长时间运行，阻塞时间可能很长。
  - another solution：所有正在进行事务的日志信息被 checkpoint 保存在 CKPT record 中，此时 CKPT record 的完成等待的就是所有 operation 的完成（而非完整事务的完成），这个过程比较迅速。

redo-only 和 undo-redo 的选择：取决于 system goals。
Redo-only is generally faster：更少的 disk operations，recovery 只需扫描日志一次，不需要来回扫描。
因此，一般默认选择 redo-only，undo-redo 往往用于 transactions too large for memory。

## before-or-after atomicity: consistency under concurrency

延迟：排队时间和请求处理时间，排队时间是指请求在队列中等待的时间，取决于系统中的请求数量（尤其是堆积的请求）和系统的处理能力。
`Queue requests = (λ - Throughput) * T` ，λ 是请求到达率，T 是请求处理时间，throughtput 是系统的处理能力。
分析等待时间：平均延迟 W 和 平均排队长度 L 的关系由 Little's Law 给出：`L = λ * W`，其中 λ 是请求到达率，W 是平均延迟。

### improve throughput & locks

并行的时候，系统的 throughput 可能会提高，但也可能会降低。此外，并行带来的问题有：race condition。
我们需要完成的是，使有关联的并行操作之间有正确的顺序，保证系统状态的一致性，也就是对于关联的操作，必须保证它们的执行顺序与某个合法的串行顺序一致。

**locks:** 通过锁机制来保证并行操作之间的顺序。同时，为了增加并发性，需要调整锁的粒度，减少锁的范围和持有时间。
**static locking：** 然而，细粒度锁也可能有问题，我们采用 static locking，在设计时就确定锁的粒度和范围，在实际操作前先获取所有需要的锁，操作完成后再释放所有锁。其问题在于需要预先知道所有需要的锁，以及拿锁时间太长，性能上不好。

**two-phase locking (2PL)：** 通过两阶段锁协议来保证并行操作之间的顺序。其基本思想是：需要访问的资源在操作开始前先获取锁，否则可以先不获取，一旦释放了锁，就不能再获取锁，即后续操作全都为释放锁阶段。

如何证明 2PL 保证两个并发的执行等于某个合法的串行执行？
**view serializability：** 
1. 初始状态相同，即读的值相同；
2. 对一个值的写操作相同；
3. 最终状态相同，即最后写的值相同。

然而，view serializability 并不能作为检查和证明的工具，因为它需要检查所有可能的执行顺序，复杂度很高。
**conflict graph：** 通过构建冲突图来检查并发操作的合法性。冲突图的节点是事务，边表示事务之间的冲突关系（依赖关系，先后关系），也就是某个事务必须在另一个事务之前执行。如果这个图中有环，则说明存在循环依赖，无法保证并发操作的合法性；
然而，conflict graph 可以证明并发操作的合法性，但也可能将一些合法的并发操作判定为不合法。例如，一个 read 和 三个 write 的操作，可能存在合法的并发执行，但冲突图中可能会出现环，导致判定为不合法。

由此，我们知道 view serializability 是一个更强的条件，conflict serializability 是其中的一种情况。

### 什么叫“正确”的系统？

**deadlock：** 如果系统中存在多个事务相互等待对方释放锁，导致无法继续执行，就会出现死锁。
solution：
1. pre-defined order：在设计时就确定锁的获取顺序，避免循环等待；
2. waiting graph：通过构建等待图来检测死锁，如果图中存在环，则说明存在死锁，然后对环中的事务进行回滚，释放锁，打破死锁；
3. TX timeout：设置事务的超时时间，如果超过时间未完成，则回滚事务，释放锁。

### OCC

**optimistic concurrency control (OCC)：** 假设大部分情况下事务之间不会冲突，因此在执行事务时不加锁，而是在提交时检查是否有冲突，如果有冲突，则回滚事务，重新执行。

occ 执行事务的三个阶段：
1. concurrent phase：事务执行时不加锁，记录读写的对象和版本号，read data 并 buffer write data，写入 buffer 中；
2. 检查 phase：在提交事务前，检查读写的对象是否有冲突，即是否有其他事务在此期间修改了这些对象；
3. commit phase：如果没有冲突，则将 buffer 中的写入数据提交到数据库中。

**critical section：** 在检查 phase 和 commit phase 之间，需要保证这两个阶段（phase2 + phase3）的原子性，即在检查和提交之间不能有其他事务修改这些对象。
如何实现这个 critical section：可以通过加锁来实现，先获取一个全局锁，然后检查所有 read() 和 write() 的对象是否改变，实际上这里的全局锁只需要拿 write lock，因为 read() 的对象不需要加锁；同时，由于不能加锁，因此需要在检查时检查其是否加锁。具体实现如下：
```c
def validate_and_commit() // phase 2 & 3 with before-or-after
    for d in sorted(write-set):
        d.lock()
    for d in read-set:        
        if d has changed or d has been locked:            
            abort()
    for d in write-set:
        write(d)
    // release the locks
    ...
```

这段代码中，判断 `d has changed` 的方法是：在 read() 时记录其 version number 版本号，提交时检查其版本号是否改变。

**pros and cons of OCC：**
1. 优点：执行阶段速度快，上锁时间少，没有死锁的问题；
2. 缺点：在 workload 高的情况下，事务冲突频繁，回滚次数多，且对一些没有问题的场景也会触发回滚，导致性能下降。

因此，在 2PL 和 OCC 之间的选择，取决于系统的 workload 特性。

### transaction

transaction 的定义：一段程序执行的逻辑单元，具有 ACID 特性，即原子性（Atomicity）、一致性（Consistency）、隔离性（Isolation）和持久性（Durability）。其中 consistency 是指事务执行前后，状态必须满足系统的约束条件，是最难保证的特性。

在某些特定场景下，我们是可以实现 high-performance isolation 的，尤其是读多写少的场景。

### multi-version concurrency control (MVCC)

MVCC 通过为每个数据对象维护多个版本来实现并发控制，也就是维护多个 snapshot。对于每个数据保存一个 chain，这个 chain 记录了该数据的所有 version。

时间戳 time stamp：每个事务在开始时获取一个唯一的时间戳，作为该事务的标识，一般的简单实现是 global counter，每次事务开始时自增；

phase 1：read data belong to the snapshot, buffer write data in memory；
phase 2：commits：install the write set with the commit time。

做 snapshot 时，需要先 lock the data，防止在 snapshot 过程中数据被其他事务读写，完成后再 release the lock。同时，多个事务可以同时读同一个 snapshot，但写入时需要保证写入的版本是最新的。

总之，MVCC 通过维护通过 time stamp 标识的多个版本和 snapshot，保证读的并行，以及通过缓存保证写的原子性，然后在 commit 时安装写入的版本，从而实现高性能的并发控制。

**snapshot isolation：**
MVCC 的 snapshot isolation 是指 MVCC 没有 read validation 的机制，也就是在 commit 时不检查 read set 是否被其他事务修改过，这样就存在 before-or-after 的问题。因此可以增加 read validation 的机制，在 commit 时检查 read set 是否被其他事务修改过，也就是和 OCC 的检查 phase 类似的配合，这样 MVCC 在 read-only 仍可以提高并发性，不过其他情况下性能相对较低。

## consistency under partial failure
10.20-10.29的3.5节课

现在我们讨论跨机器的 consistency，尤其是在分布式系统中，如何保证在部分机器发生故障时，系统仍然能够保持一致性，也就是保证 all sites all commit or all abort。
和单机 All-or-nothing 的操作不同的是，单机可以通过一个 log 来保证 atomicity，而在分布式系统中，多个 site 之间不便于共享一个 log，如果各自维护自己的 log，也同样会出现 crash consistency 的问题。
因此，我们采用 2PC（two-phase commit）协议来保证分布式系统的 atomicity。

**2PC (two-phase commit) ：** 决定都由 *coordinator* 来做，也就是一个人做整体的决定，coordinator 自己也有一个log。log有三个状态：not committed, prepared, committed。整体流程是：
1. 每个 server 在本地执行事务，直到 coordinator 发出 commit request；
2. 发送 commit request 后，coordinator 进入 phase 1，等待所有 server 的 vote；回答 yes 的 server 的 log 进入 prepared 状态，否则 not committed；
3. server 报告后，coordinator 设置一个 commit point，进入 phase 2，向所有 server 发送 commit/abort 的决定；
4. 进入 phase 2，每个 server 自行执行 commit/abort。

之前方法的扩展：
1. 2PL：lower-layer TX 不能在 higher-layer TX commit 之前完成，也不能释放锁；
2. OCC：先分布式地把所有锁都拿到，然后再 commit，其实 occ 的过程类似 prepare；
3. checkpoint：把 prepared 也写进 log，保证 crash 后可以恢复。

### replicated state machine

我们讨论的问题主要是：为什么 coordinate 挂了后不好处理？coordinate 挂了的情况下有什么处理办法？

**CAP：** consistency 是指所有状态保持一致，availability 是指系统能够在一定时间内响应请求，无论 success 或 fail。CAP 定理指出，在分布式系统中，无法同时保证 consistency、availability 和 partition tolerance，原因是出现 network partition 时，系统必须在 consistency 和 availability 之间做出选择。`例如，有时会存在一个节点无法访问另一个节点的情况，此时系统必须选择是继续提供服务（availability）（这个服务可能会导致数据不一致），还是暂时拒绝服务以保证一致性（consistency）。` 此外，CP 和 AP 的选择也取决于系统的需求和设计目标，例如微信的聊天系统更注重 availability，而银行系统更注重 consistency。

**replication的思路：** replication 指的是在分布式系统中，将数据或服务的副本分布在多个节点上，这样可以在某些节点发生故障时，其他节点仍然可以提供服务.

我们之前提过，对于 consistency 的问题有两种处理方法：1. optimistic replication，e.g. [eventual consistency](#eventual-consistency)，只保证最终结果一致；2. pessimistic replication，e.g. [primary-backup replication](#primary-backup-replication) ，保证所有副本在任何时刻都保持一致。

**RSM (replicated state machine)：** 把一个 server 抽象成一个 state machine，也就是 state + input -> output + new state，因此不同 replica 的状态输入相同，输出也相同。


#### primary-backup replication 的问题：primary 挂了怎么办？

primary fails后，需要决定谁来接管 primary 的角色，思路有：1. human/agent decide; 2. monitor automatically watch and elect a new primary。

采用第二种方法时，如果使用多台 monitor，可能出现 network partition，导致不同的 monitor 对 primary 的状态有不同的判断，从而可能出现多个 primary。
我们现在知道，出现多个 primary 的情况是不可避免的。所以我们需要保证，即使系统出现多个 primary，也不会破坏系统的正确性。view server 提供了区分最新 primary 的机制。

我们选用 **view server** 作为 monitor，负责管理所有 primary 和 backup 的状态。view server 维护一个 view，记录当前的 primary 和 backup 的状态，并通过心跳机制监控它们的状态。如果 primary 挂了，view server 会选举一个新的 primary，并通知所有 backup。
view server 记录一个 **view number** ，表示当前 view 的版本号。因此当一个请求被接收，检查它的 view number，如果低于当前 view number，就拒绝该请求，保证所有请求都在最新的 view 中处理。

#### primary-backup 的基本协议

为了保证 primary-backup 的一致性，primary 需要在处理请求时，将请求的结果同步到 backup。具体流程如下：
1. primary 接收到请求后，先将请求的结果写入自己的 log，然后将请求发送给 backup；
2. 至少把请求发送给 W 个 backup，等待它们的 ack；
3. 如果 primary fails，选择 R 个 backup，选择其中即时信息最多的 backup 作为新的 primary；
需要保证的是：
- W + R > N，其中 N 是 backup 的总数，这样可以保证至少有一个 backup 收到请求的结果，从而保证系统的一致性；
- primary 需要取 backup 的 log 并同步到自己的 log 中，保证所有 backup 的 log 一致.

## paxos & raft

### paxos

view server 的服务需要一些共识协议完成支持，paxos 是一种共识协议，它的目标是保证在分布式系统中，即使部分节点发生故障，仍然能够达成一致的决策。
我们要求分布式系统的 consistency 和 availability，这里的 availability 是大部分机器满足即可。

paxos 的基本思想是：通过多数派投票来保证一致性。没有一个固定的 primary，每个人都可能成为 primary。每个节点有一个 proposal number，其他节点通过投票来决定是否接受该 proposal。
具体如下：
1. 每个 client 包括：proposer, acceptor, learner；proposer 提出一个 proposal，可以发送给 acceptor；
2. proposer 认为自己有写的权利，取一个 proposal number(Nh)，发送给其他 acceptor；其他 acceptor 收到后，检查 proposal number 是否大于自己已经接受的 number，如果是，则接受该 proposal，并回复 proposer；超过半数的 acceptor 接受即可。
3. 为了保证超过半数的结果完成后，不会再被修改，每个 client 记录 Na/Va 表示当前最新 accept 的 number.
- 为了防止两个 proposer 拿到相同的 proposal number，每个proposal number 都携带 userId.

然而，在实际生产中，view server 需要不断决定新的配置，single paxos 只能决定一个view instance，不能再改变。因此 paxos 通常以 multi-paxos 的形式，用一系列 paxos instance 分别决定不同位置的值，组成一条有序的 log。
1. 每个 server 的 log 可能不一样，因此在写时如果发现冲突（例如，预计在 server 1的下一个位置写入新instance时，发现其他 server 已经接受了），就需要先保留和同步其他 server 的 log，然后再持续增大 instance number 重试，直到 log 一致和成功写入；
2. 优化：多个 server 可能接收和争抢 log 位置，因此 client 把请求交给同一个 leader，leader 使用同一个 proposal number 完成多个 instance 的 prepare，从而节约了两轮 prepare + accept 的开销。

### raft

raft 和 Paxos 类似地，不需要 view server 的参与，通过选举 leader 来完成一致性。与 Paxos 不同的是，raft 明确了 leader 的选举方式和情况。其主线是三步：leader election, log replication, safety。

#### leader election

每个 server 都有一个 term，表示当前的任期。
1. 每个 server 在启动时都是 follower，如果在一定时间内没有收到 leader 的心跳，就会变成 candidate 发起一轮新的选举。
2. 发起新的选举时，candidate 把自己的 term+1，向其他 server 发送请求投票，如果收到超过半数的投票（term 更大 且 没有投过票），就成为 leader。
3. eletion的两个要求：
   1. safety：同一 term 下只存在一个 leader；
   2. liveness：“好的事情” 最终会发生，也就是最终会选出一个 leader。具体的方法是，每个 server 在发现没有收到心跳时，等待一个随机的时间间隔（T-2*T）后再发起选举，防止多个 server 同时发起选举导致 vote split。
- currentTerm 和 votedFor：这两个 state variable必须要记录在 disk 上，防止 crash 后丢失。

#### log replication

所有 follower(client) 把 command 发送给 leader，leader 将其 append 到自己的 log 中，然后 replicate 给所有 follower。

log entry = index + term + command，判断 entry 是否 committed 的条件是：它最终会被所有的 server 执行 with the same value。

为了解决 crashed and partitions 使 log diverge 的问题，raft 采用了一个机制：
**机制：** 如果 log entries 的 index 和 term 相同，则认为它们是相同的 entry，并且其之前的 entries 也相同；
**实现** ：append 前做一个 consistency check，检查 follower 的 log 是否和 leader 的 log 一致，如果一致，则 append；如果不一致，则 reject。
发生 reject 时，完成一个修复 follower log 的过程：从后往前逐个检查 follower 的 log entry，直到找到匹配的位置，然后从该位置开始 append leader 的 log entry，这里也发生了 follower log 的 truncate，删除不一致的 entry。

#### safety

1. pick the best leader：case 1：相同前缀情况下，选举 log 更长的 candidate；case 2：如果有更新的 term，则选举 term 更大的 candidate。
2. commit rule：即使超过半数的机器写成功，也不能保证 log entry 被 commit。

## Introduction to Network
- xyb 归来

**Application layer:** HTTP, SMTP, FTP, DNS, RPC
**Transport layer:** TCP, UDP；对于这两个协议，应用层可以选择使用哪一个，TCP发送的 packet 包括：source port, destination port, sequence number(用于识别), ack number, checksum, data等等；UDP 则包括的信息较少，TCP 提供可靠的传输。
**Network layer(Internet Layer, IP layer)：** IP 包跨越不同的网络到达目的主机，是通过多个路由器转发的，经过多个 hop，最后到达 destination。每个 hop 都会有一个 TTL(time to live) 值，防止 packet 在网络中无限循环。

### Link layer

link layer是什么：

使用共享时钟完成 physical transmission，保证数据在物理层的传输顺序。

如果没有共享时钟，以三根线的方式传输数据为例：data line, ready line, acknowledge line，A 把数据放在 data line 上，改变 ready 信号，B 看到 ready 信号后读取数据，改变 acknowledge 信号，A 看到 ack 信号后，知道数据已经被读取，可以继续发送下一条数据。这里会有性能开销。有 Propagation Delay (传播延迟)。

并行和串行传输：并行使用 N 根线提高速率，但距离增加导致时序问题；串行使用一根线连续发送数据，无须等待恢复。

clock：发送的波形经过真实线路后会出现波的畸变，因此需要尝试恢复和修正 clock。给出的一些修正措施如：VCO（Voltage Controlled Oscillator，压控振荡器），PLL（Phase-Locked Loop，锁相环）等，但如果发送的数据长时间没有变化，难以校准 clock。由此引入 manchester encoding。

**manchester code：** 通过在每个 bit 的中间插入一个 transition 来表示 bit 的值，0-> 01，1-> 10，牺牲传输速率换取 clock 的恢复能力。

#### Multiplexing：多个设备共享同一条物理线路的传输能力。

如何让多个设备共享同一条物理线路？how to share a connection？有两种方式：

Isochronous transmission 等时传输，保证每个设备在固定时间间隔内有机会发送数据；TDM(Time Division Multiplexing) 时分复用，给每个设备分配固定的时间片；电话系统一般采用 TDM。

Asynchronous transmission 异步传输，设备在有数据要发送时才发送数据；

**frame and packet:** 对于计算机网络，会有 bursty traffic，设备可能在某些时间段内有大量数据要发送，而在其他时间段没有数据要发送。因此，将数据分成 packets 发送，每个 packet 包含 header 和 payload，设备需要发送时才把 packet 放到物理线路上。

**Multiplexing/Demultiplexing:** 交换设备的基本工作方式：multiplexing复用 指的是多个输入的数据包进入同一个输出链路，demultiplexing解复用 指的是设备读取包头中的目的信息，决定将数据包发送到哪个输出链路。Buffer/Queue：临时保存 pending 的数据包，等待发送。Forwarding table：记录不同目的地应该使用的输出链路。

#### 错误处理

framing frames：接收端识别 frame 的边界，就是将连续的 bit 流分成一个个 frame。

...

**Hamming distance:** 两个等长 bit 串的 Hamming Distance，指对应位置不同的 bit 个数。
**Hamming code:** 通过将 4-bit data 编码成 7-bit codeword，增加了 3 个 parity bits，能够检测并纠正单个 bit 错误。设置 parity bits 的位置为 1, 2, 4，三个 parity bits 分别检查不同的 bit 组合，计算成为它们的异或，其中：
- parity bit 1 检查 bits 3, 5, 7
- parity bit 2 检查 bits 3, 6, 7
- parity bit 4 检查 bits 5, 6, 7
通过判断 P1, P2, P4 的值，就可以确定哪个 bit 出错。

不过如果出现三个 bit 错误，Hamming code 就无法纠正了。

### network layer

两种类型的 network：
1. best-effort network：尽力而为的网络，尝试将数据包送到目的地，但不保证一定成功，也不保证顺序正确。
2. guaranteed-delivery network：保证交付的网络，确保数据包一定会送到目的地，并且顺序正确。

IP：best-effort network。

...

#### routing：

routing：在网络中选择一条路径，将数据包从源节点传输到目的节点。

distributed routing：
1. hello protocol：每个节点定期向邻居发送 hello 消息，通过接收 hello 消息来维护邻居列表；
2. advertisement：得知其他的节点的存在和状态，通过广播或多播的方式将自己的状态告知其他节点；
3. 计算 routing table：根据邻居列表和收到的 advertisement，计算出到达每个目的节点的最优路径，并更新 routing table。

计算路由的两种算法：
1. link-state routing：advertisement 中包含了每个节点的邻居和路径长度，且向所有其他节点广播，拼出完整网络图后，使用 Dijkstra 算法计算最短路径；
2. distance-vector routing：advertisement 中只包含自己到达每个目的节点的距离，只告诉邻居，根据邻居报告的距离用 bellman-ford 算法计算最短路径。

然而，distance-vector routing 可能会出现 count-to-infinity 问题。也就是：如果某个节点的路径在某个时间断开，之后每次更新时，节点会将自己的距离加 1，然后广播给邻居，邻居又会将自己的距离加 1，然后广播给其他邻居，依此类推，导致距离不断增加，直到达到一个很大的值（无限大）。
解决的方法是： **split horizon** ，禁止节点将来源于某个邻居的路由信息再次发送给该邻居。

#### scale the routing

1. hierarchical routing：将网络划分为多个区域，也就是在每个区域内连接，区域之间通过网关连接。
    - 用多级的方式来组织网络，减少路由表的大小和更新的频率。region 间的 routing table 指向其他 region 的 gateway，而 region 内则指向内部具体的节点。
2. path-vector routing：在 advertisement 中包含了到达每个目的节点的路径信息，防止环路的产生。
    - 通告时会包含一条路径经过的节点序列。当某个节点收到路径信息时，可以检查这条路径里是否已经包含自己，然后决定是否接受这条路径，避免环路的产生。
3. topological addressing：将网络中的节点按照拓扑结构进行编号，便于路由的计算和管理。
    - 通过 ip address 来表示节点的拓扑位置，便于路由的计算和管理。
    CIDR（Classless Inter-Domain Routing，无类别域间路由）能够用前缀表示整个地址区间：

#### data plane

forward an IP packet：转发数据包的过程包括：找到目的地址，查找路由表，选择下一跳，更新数据包的 TTL 和 checksum，然后将数据包发送到下一跳。

快速转发的方法：    

#### NAT(Network Address Translation)

NAT 是一种将私有网络地址转换为公共网络地址的技术，允许多个设备共享一个公共 IP 地址访问互联网。
具体的过程在于：私有网络连接公网时，netgate 会将私有 IP 地址和端口号映射到公共 IP 地址和端口号，并在数据包返回时进行反向转换。

#### Ethernet

在 layer mapping 时，由于网络地址允许重复，如果接收方在另一个网络中，需要发送方 maintain 一个 mapping table，这个table中对接收方的记录是 router 的 MAC address，而不是接收方的 MAC address，这样 router 就可以将数据包转发到正确的网络中。

### 中间差11.5/11.10

### DNS & Naming Scheme

DNS 也是一种端到端的协议，look-up algorithm 给域名的时候可以找到协议。router 拿到 hostname 后映射给 IP address，hostname 是 human-friendly 的。
一个 hostname 可以映射到多个 IP address，一个 IP address 也可以映射到多个 hostname。

**look-up algorithm：** 最初是通过 hosts.txt 文件来记录 -> BIND -> distributed DNS。BIND 是 Berkeley Internet Name Domain 的缩写，主要是一个 DNS 服务器软件，支持分布式 DNS 的实现。BIND 通过将域名空间划分为多个区域（zone），每个区域由一个或多个 DNS 服务器负责管理，从而实现了分布式的域名解析。
**delegation委派:** 主要算法从后往前查找，例如 `ipads.sjtu.edu.cn`，先查找 `cn` -> `edu` -> `sjtu` -> `ipads`，每个域名对应一个 DNS 服务器（这个服务器负责处理该域名的查询请求），DNS 服务器之间通过递归查询来完成域名解析。

DNS 中的 name 是 global 的(context-free)，context-free 的意思是，DNS 中的域名是全局唯一的，不依赖于特定的上下文或环境。

**DNS request process：** 一次 DNS 查询的过程有三次增强：
1. 从附近的服务器开始：第一次 DNS request 不一定走向 root server，可以先向一个已经知道地址的 DNS 服务器询问，可以减少查询的时间和网络负载；
2. 递归查询，向其他 DNS 服务器查询，其他的 DNS 服务器会继续向下查询，直到找到最终的 IP 地址；
3. 缓存，DNS 服务器会将查询结果缓存一段时间，响应中也有 TTL(time to live) 字段。
其他特征：
- 有若干 replica，分布在不同的地理位置；
- organization 的 DNS server，例如 SJTU，学校内若干台，至少有一台在校外。

**DNS 的 pros & cons：**
pros：global names，scalable in performance/management, fault tolerant
cons：policy(谁负责管理), load on root server, security(恶意攻击，DNS spoofing).

content distribution:

CDN (Content Distribution Network) 是一种通过在全球范围内部署多个缓存服务器，将内容分发到离用户更近的服务器上，从而提高访问速度和可靠性的方法。CDN 通过主动地把 network content 分发到各个缓存服务器上，用户访问时就可以直接使用缓存了。
CDN 缓存的内容主要是一些实际资源，例如图片、视频、网页等，DNS 的缓存则是一些 IP 地址和域名的映射关系。

Akamai 的缓存方法：用户访问并请求一个网页时，获得一个图片地址，但还没有实际得到这个图片。用户的访问被多次 redirect，最终解析被引入一个 Akamai 的 cache server，这个 cache server 可能在用户附近，缓存了该图片的副本，从而提高访问速度和减少网络负载。

**Naming Scheme** 定义了： Name space：允许使用哪些名字；Values：名字可以对应什么值或对象；Mapping algorithm：怎样把名字解析成值。
naming 的设计目标是：sharing, hiding(隐藏 implementation details), user-friendly, retrieval(检索)
