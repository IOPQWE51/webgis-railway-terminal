# 🚀 Mapbox 霓虹金地图 - 使用示例

## 📦 安装依赖

首先需要安装 Mapbox GL JS：

```bash
npm install mapbox-gl
```

或

```bash
yarn add mapbox-gl
```

---

## 🎯 快速开始

### 示例1：基础地图（使用默认样式）

```jsx
import MapboxMap from '@/components/MapboxMap';

function App() {
  return (
    <div style={{ width: '100%', height: '500px' }}>
      <MapboxMap
        center={[139.6503, 35.6762]} // 东京
        zoom={12}
      />
    </div>
  );
}
```

### 示例2：使用自定义霓虹金样式

```jsx
import MapboxMap from '@/components/MapboxMap';

function TacticalMap() {
  // 🌟 在 Mapbox Studio 创建的自定义样式
  const NEON_AMBER_STYLE = 'mapbox://styles/iopqwe51/xxxxxxxxxxxxxxxx';

  return (
    <div style={{ width: '100%', height: '500px' }}>
      <MapboxMap
        styleUrl={NEON_AMBER_STYLE}
        center={[139.6503, 35.6762]}
        zoom={13}
      />
    </div>
  );
}
```

### 示例3：添加标记点

```jsx
import { useState } from 'react';
import MapboxMap from '@/components/MapboxMap';

function MapWithMarkers() {
  const [markers, setMarkers] = useState([
    {
      longitude: 139.6503,
      latitude: 35.6762,
      color: '#fbbf24', // 琥珀金
      label: '东京站'
    },
    {
      longitude: 139.7645,
      latitude: 35.6812,
      color: '#ef4444', // 红色（重要站点）
      label: '新宿站'
    },
    {
      longitude: 135.5023,
      latitude: 34.6937,
      color: '#3b82f6', // 蓝色（普通站点）
      label: '大阪站'
    }
  ]);

  return (
    <div style={{ width: '100%', height: '500px' }}>
      <MapboxMap
        center={[139.6503, 35.6762]}
        zoom={10}
        markers={markers}
      />
    </div>
  );
}
```

### 示例4：点击地图添加标记

```jsx
import { useState } from 'react';
import MapboxMap from '@/components/MapboxMap';

function InteractiveMap() {
  const [markers, setMarkers] = useState([]);

  const handleMapClick = ({ longitude, latitude }) => {
    console.log('点击位置:', { longitude, latitude });

    // 添加新标记
    const newMarker = {
      longitude,
      latitude,
      color: '#fbbf24',
      label: `标记 ${markers.length + 1}`
    };

    setMarkers([...markers, newMarker]);
  };

  return (
    <div>
      <div style={{ marginBottom: '10px' }}>
        已标记: {markers.length} 个点位
      </div>
      <MapboxMap
        center={[139.6503, 35.6762]}
        zoom={12}
        markers={markers}
        onMapClick={handleMapClick}
      />
    </div>
  );
}
```

---

## 🎨 预定义样式

### 日本铁路风格

```jsx
// 东京山手线
const YAMANOTE_LINE_STYLE = {
  center: [139.7645, 35.6812],
  zoom: 12,
  markers: [
    { longitude: 139.7645, latitude: 35.6812, color: '#fbbf24', label: '新宿站' },
    { longitude: 139.7006, latitude: 35.6895, color: '#fbbf24', label: '池袋站' },
    { longitude: 139.6503, latitude: 35.6762, color: '#fbbf24', label: '东京站' },
    { longitude: 139.7772, latitude: 35.7138, color: '#fbbf24', label: '上野站' }
  ]
};

<MapboxMap {...YAMANOTE_LINE_STYLE} />
```

### 美国铁路风格

```jsx
// 纽约地铁
const NYC_SUBWAY_STYLE = {
  center: [-73.9851, 40.7484], // 时代广场
  zoom: 13,
  markers: [
    { longitude: -73.9851, latitude: 40.7484, color: '#fbbf24', label: '时代广场' },
    { longitude: -73.9442, latitude: 40.8176, color: '#fbbf24', label: '中央车站' },
    { longitude: -74.0060, latitude: 40.7128, color: '#fbbf24', label: '世贸中心' }
  ]
};

<MapboxMap {...NYC_SUBWAY_STYLE} />
```

---

## 🔧 高级功能

### 1. 动态切换样式

```jsx
import { useState } from 'react';

function StyleSwitcher() {
  const [currentStyle, setCurrentStyle] = useState('default');

  const styles = {
    default: 'mapbox://styles/mapbox/streets-v12',
    neon: 'mapbox://styles/iopqwe51/xxxxxxxxxxxxxxxx', // 你的霓虹金样式
    dark: 'mapbox://styles/mapbox/dark-v11',
    satellite: 'mapbox://styles/mapbox/satellite-v9'
  };

  return (
    <div>
      <div>
        <button onClick={() => setCurrentStyle('default')}>默认</button>
        <button onClick={() => setCurrentStyle('neon')}>霓虹金</button>
        <button onClick={() => setCurrentStyle('dark')}>暗色</button>
        <button onClick={() => setCurrentStyle('satellite')}>卫星</button>
      </div>
      <MapboxMap
        styleUrl={styles[currentStyle]}
        center={[139.6503, 35.6762]}
        zoom={12}
      />
    </div>
  );
}
```

### 2. 铁路路线高亮

```jsx
function RailwayHighlighter() {
  const [activeRailway, setActiveRailway] = useState(null);

  // 定义铁路路线
  const railways = {
    yamanote: {
      name: '山手线',
      color: '#fbbf24',
      coordinates: [
        [139.7645, 35.6812], // 新宿
        [139.7006, 35.6895], // 池袋
        [139.6503, 35.6762]  // 东京
      ]
    },
    chuo: {
      name: '中央线',
      color: '#ef4444',
      coordinates: [
        [139.7006, 35.6895], // 新宿
        [139.6503, 35.6762]  // 东京
      ]
    }
  };

  return (
    <div>
      <div>
        {Object.keys(railways).map(key => (
          <button
            key={key}
            onClick={() => setActiveRailway(key)}
            style={{
              backgroundColor: activeRailway === key ? railways[key].color : '#ccc'
            }}
          >
            {railways[key].name}
          </button>
        ))}
      </div>
      <MapboxMap
        center={[139.7006, 35.6895]}
        zoom={11}
        markers={
          activeRailway
            ? railways[activeRailway].coordinates.map(coord => ({
                longitude: coord[0],
                latitude: coord[1],
                color: railways[activeRailway].color
              }))
            : []
        }
      />
    </div>
  );
}
```

### 3. 摄影点位标记

```jsx
import { useState } from 'react';
import MapboxMap from '@/components/MapboxMap';

function PhotoLocationMap() {
  // 📸 摄影点位数据
  const [photoLocations, setPhotoLocations] = useState([
    {
      id: 1,
      longitude: 139.6503,
      latitude: 35.6762,
      name: '东京站丸之内',
      type: 'spot',
      bestTime: '日出',
      season: 'spring'
    },
    {
      id: 2,
      longitude: 139.7645,
      latitude: 35.6812,
      name: '新宿站西口',
      type: 'spot',
      bestTime: '蓝调时刻',
      season: 'winter'
    }
  ]);

  return (
    <div>
      <MapboxMap
        center={[139.7006, 35.6895]}
        zoom={11}
        markers={photoLocations.map(loc => ({
          longitude: loc.longitude,
          latitude: loc.latitude,
          color: loc.type === 'spot' ? '#fbbf24' : '#3b82f6',
          label: loc.name
        }))}
      />
      <div>
        {photoLocations.map(loc => (
          <div key={loc.id}>
            <h3>{loc.name}</h3>
            <p>最佳时间: {loc.bestTime}</p>
            <p>最佳季节: {loc.season}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 🧪 测试方法

### 本地测试

1. **启动开发服务器**：
```bash
npm run dev
```

2. **打开浏览器**：
```
http://localhost:3000
```

3. **检查控制台**：
```javascript
// 应该看到：
// 🗺️ 地图加载完成
// 🚂 发现铁路图层: [...]
```

### 验证霓虹金效果

1. ✅ 铁路显示为琥珀金色 (#fbbf24)
2. ✅ 水体显示为深空灰色 (#1e293b)
3. ✅ 车站标记突出显示
4. ✅ 整体视觉风格统一

### 跨浏览器测试

测试以下浏览器：
- ✅ Chrome/Edge (推荐)
- ✅ Firefox
- ✅ Safari
- ⚠️ IE11 (不支持，Mapbox GL JS 需要 WebGL)

---

## 🐛 常见问题

### Q1: 地图不显示？

**检查**：
```javascript
// 1. 确认 Token 已设置
console.log('Mapbox Token:', mapboxgl.accessToken);

// 2. 确认样式 URL 正确
console.log('Style URL:', styleUrl);

// 3. 检查浏览器控制台是否有错误
```

### Q2: 铁路没有霓虹金效果？

**原因**：
- 样式 URL 指向的是默认样式，不是自定义样式
- 需要在 Mapbox Studio 创建并发布自定义样式

**解决**：
1. 按照 [Mapbox Studio 指南](./MAPBOX_STUDIO_GUIDE.md) 创建样式
2. 复制 Style URL
3. 更新代码中的 `styleUrl` 参数

### Q3: 标记点不显示？

**检查**：
```javascript
// 确认 markers 数组格式正确
console.log('Markers:', markers);

// 每个标记应该有：
{
  longitude: 139.6503,  // 必需
  latitude: 35.6762,   // 必需
  color: '#fbbf24',    // 可选
  label: '东京站'      // 可选
}
```

---

## 📊 性能优化

### 1. 懒加载地图组件

```jsx
import lazy from 'react-lazy';

const MapboxMap = lazy(() => import('@/components/MapboxMap'));

function App() {
  return (
    <Suspense fallback={<div>加载地图...</div>}>
      <MapboxMap />
    </Suspense>
  );
}
```

### 2. 限制标记数量

```javascript
// 如果标记点超过100个，考虑聚类
import { useState, useMemo } from 'react';

function MapWithManyMarkers({ allMarkers }) {
  // 只显示可见区域的标记
  const visibleMarkers = useMemo(() => {
    return allMarkers.filter(marker => {
      // 根据当前视野过滤
      return isInViewport(marker, viewport);
    });
  }, [allMarkers, viewport]);

  return <MapboxMap markers={visibleMarkers} />;
}
```

### 3. 使用 Web Worker

对于大量地理计算，使用 Web Worker：

```javascript
// worker.js
self.onmessage = function(e) {
  const { markers, viewport } = e.data;
  const visibleMarkers = filterMarkers(markers, viewport);
  self.postMessage(visibleMarkers);
};
```

---

## 🎯 下一步

完成基础地图集成后：

1. ✅ 测试不同城市的铁路效果
2. ✅ 添加更多交互功能
3. ✅ 实现 [功能2：三维地形重构](../README.md#功能2)
4. ✅ 实现 [功能3：等时线分析](../README.md#功能3)

---

**维护者**: IOPQWE51
**版本**: v1.0
**最后更新**: 2026-04-07
