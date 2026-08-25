// src/components/ErrorBoundary.jsx
// 🛡️ 组件级错误边界：局部崩溃时展示战术风降级 UI，
// 而不是让整个终端白屏。
//
// 用法：
//   <ErrorBoundary label="战术雷达" onReset={() => setIsTacticalMode(false)}>
//     <SomeExplosiveComponent />
//   </ErrorBoundary>
//
// onReset（可选）：父组件提供的"优雅退出"动作（如关闭战术模式）；
// 不传时只提供"重试"与"刷新页面"两个通用按钮。

import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // 服务端监控（Sentry）已全局接管上报，这里只补本地上下文日志
    console.error(`💥 [${this.props.label || '组件'}] 崩溃:`, error, info?.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { label = '模块', onReset } = this.props;
    const message = this.state.error?.message || '未知异常';

    return (
      <div
        className="min-h-[60vh] flex items-center justify-center p-6 bg-slate-950"
        role="alert"
      >
        <div className="max-w-md w-full bg-slate-900 border border-amber-500/30 rounded-2xl p-8 text-center shadow-2xl">
          <div className="text-5xl mb-4">💥</div>
          <h2 className="text-xl font-bold text-amber-400 mb-2 font-mono tracking-widest">
            [ {label} 故障 ]
          </h2>
          <p className="text-sm text-slate-400 mb-1">
            模块遇到异常已隔离，其余系统未受影响。
          </p>
          <p className="text-xs text-slate-600 font-mono mb-6 break-all line-clamp-2">
            {message}
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {typeof onReset === 'function' && (
              <button
                onClick={onReset}
                className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 text-sm font-bold hover:bg-amber-400 transition-colors"
              >
                安全退出
              </button>
            )}
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 rounded-lg border border-cyan-500/40 text-cyan-300 text-sm font-bold hover:bg-cyan-500/10 transition-colors"
            >
              重试
            </button>
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-800 transition-colors"
            >
              刷新页面
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
