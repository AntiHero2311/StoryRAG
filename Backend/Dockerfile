# ─────────────────────────────────────────────
# Stage 1: Build
# ─────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy solution + csproj files trước để tận dụng layer cache khi restore
COPY Backend.sln .
COPY Api/Api.csproj             Api/
COPY Service/Service.csproj     Service/
COPY Repository/Repository.csproj Repository/

RUN dotnet restore

# Copy toàn bộ source code
COPY . .

# Publish ở chế độ Release, output ra /app/publish
RUN dotnet publish Api/Api.csproj \
    -c Release \
    -o /app/publish \
    --no-restore

# ─────────────────────────────────────────────
# Stage 2: Runtime
# ─────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Chỉ copy artifact đã build — image gọn nhẹ, không có SDK
COPY --from=build /app/publish .

# ASP.NET Core mặc định lắng nghe port 8080 trong container
EXPOSE 8080

# Biến môi trường: override tại runtime, KHÔNG hardcode secret trong image
# Dùng __ làm separator (ASP.NET Core config convention)
# Ví dụ:
#   -e ConnectionStrings__DefaultConnection="..."
#   -e Gemini__ChatApiKey="..."
#   -e Jwt__Key="..."
#   -e Security__MasterKey="..."
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

ENTRYPOINT ["dotnet", "Api.dll"]
